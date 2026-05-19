/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
// eslint-disable-next-line import/no-extraneous-dependencies
import Fastify from 'fastify';
import { createHash, randomUUID } from 'crypto';

type Message = {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  MD5OfBody: string;
  Attributes: Record<string, string>;
  MessageAttributes: Record<string, unknown>;
  visibleAfter: number;
};

type Queue = {
  messages: Message[];
};

/**
 * Escapes special XML characters in a string.
 */
const xmlEscape = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Parses indexed batch parameters from an SQS Query protocol form body.
 * E.g. "Prefix.member.1.Id=x&Prefix.member.1.ReceiptHandle=y&..."
 * becomes [{ Id: 'x', ReceiptHandle: 'y' }, ...]
 */
const parseIndexedParams = (
  params: Record<string, string>,
  prefix: string,
): Record<string, string>[] => {
  const entries: Record<number, Record<string, string>> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith(`${prefix}.member.`)) {
      const rest = key.slice(`${prefix}.member.`.length);
      const dotIndex = rest.indexOf('.');
      if (dotIndex === -1) continue;
      const index = parseInt(rest.slice(0, dotIndex), 10);
      if (isNaN(index)) continue;
      const field = rest.slice(dotIndex + 1);
      if (!entries[index]) entries[index] = {};
      entries[index][field] = value;
    }
  }
  return Object.keys(entries)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .map(k => entries[parseInt(k, 10)]);
};

/**
 * Creates an in-memory Fastify server that handles both the JSON SQS protocol
 * (Content-Type: application/x-amz-json-1.0, used by aws-sdk v2 >= 2.1491.0)
 * and the Query SQS protocol (Content-Type: application/x-www-form-urlencoded,
 * used by @aws-sdk/client-sqs v3 <= 3.679.0).
 */
export const createJsonSqsServer = () => {
  const queues = new Map<string, Queue>();

  const getQueueName = (queueUrl: string): string => {
    const urlPath = queueUrl.split('/');
    return urlPath[urlPath.length - 1];
  };

  const buildQueueUrl = (host: string, queueName: string): string =>
    `http://${host}/queues/${queueName}`;

  const enqueueMessage = (queue: Queue, messageBody: string): Message => {
    const body = String(messageBody);
    const message: Message = {
      MessageId: randomUUID(),
      ReceiptHandle: randomUUID(),
      Body: body,
      MD5OfBody: createHash('md5').update(body).digest('hex'),
      Attributes: {},
      MessageAttributes: {},
      visibleAfter: 0,
    };
    queue.messages.push(message);
    return message;
  };

  const pickMessages = (
    queue: Queue,
    maxMessages: number,
    visibilityTimeoutMs: number,
  ) => {
    const now = Date.now();
    const available = queue.messages.filter(m => m.visibleAfter <= now);
    const picked = available.slice(0, maxMessages);
    const newVisibleAfter = now + visibilityTimeoutMs;
    picked.forEach(m => {
      m.visibleAfter = newVisibleAfter;
      m.ReceiptHandle = randomUUID();
    });
    return picked;
  };

  const app = Fastify({ logger: false });

  // Parser for JSON protocol (aws-sdk v2 >= 2.1491.0)
  app.addContentTypeParser(
    'application/x-amz-json-1.0',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Parser for Query protocol (@aws-sdk/client-sqs v3 <= 3.679.0)
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      const params: Record<string, string> = {};
      new URLSearchParams(body as string).forEach((value, key) => {
        params[key] = value;
      });
      done(null, params);
    },
  );

  app.post('/', async (request, reply) => {
    const contentType = (request.headers['content-type'] as string) ?? '';
    const body = request.body as Record<string, any>;
    const host =
      (request.headers.host as string) ?? `localhost:${process.env.LOCAL_SQS_PORT}`;

    // ---- JSON protocol handler (aws-sdk v2 >= 2.1491.0) ----
    if (contentType.includes('application/x-amz-json-1.0')) {
      const target = request.headers['x-amz-target'] as string | undefined;
      if (!target) {
        return reply.status(400).send({
          __type: 'MissingAction',
          message: 'Missing X-Amz-Target header',
        });
      }

      const action = target.split('.').pop()!;
      reply.header('Content-Type', 'application/x-amz-json-1.0');

      try {
        switch (action) {
          case 'CreateQueue': {
            const { QueueName } = body;
            if (!queues.has(QueueName)) {
              queues.set(QueueName, { messages: [] });
            }
            return { QueueUrl: buildQueueUrl(host, QueueName) };
          }
          case 'GetQueueUrl': {
            const { QueueName } = body;
            if (!queues.has(QueueName)) {
              return await reply.status(400).send({
                __type: 'AWS.SimpleQueueService.NonExistentQueue',
                message: 'The specified queue does not exist.',
              });
            }
            return { QueueUrl: buildQueueUrl(host, QueueName) };
          }
          case 'DeleteQueue': {
            queues.delete(getQueueName(body.QueueUrl));
            return {};
          }
          case 'SendMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await reply.status(400).send({
                __type: 'AWS.SimpleQueueService.NonExistentQueue',
                message: 'The specified queue does not exist.',
              });
            }
            const message = enqueueMessage(queue, body.MessageBody);
            return { MessageId: message.MessageId, MD5OfMessageBody: message.MD5OfBody };
          }
          case 'ReceiveMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await reply.status(400).send({
                __type: 'AWS.SimpleQueueService.NonExistentQueue',
                message: 'The specified queue does not exist.',
              });
            }
            const maxMessages = Math.min(body.MaxNumberOfMessages ?? 1, 10);
            const visibilityTimeoutMs = (body.VisibilityTimeout ?? 30) * 1000;
            const picked = pickMessages(queue, maxMessages, visibilityTimeoutMs);
            return {
              Messages: picked.map(m => ({
                MessageId: m.MessageId,
                ReceiptHandle: m.ReceiptHandle,
                MD5OfBody: m.MD5OfBody,
                Body: m.Body,
                Attributes: m.Attributes,
                MessageAttributes: m.MessageAttributes,
              })),
            };
          }
          case 'DeleteMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await reply.status(400).send({
                __type: 'AWS.SimpleQueueService.NonExistentQueue',
                message: 'The specified queue does not exist.',
              });
            }
            queue.messages = queue.messages.filter(
              m => m.ReceiptHandle !== body.ReceiptHandle,
            );
            return {};
          }
          case 'DeleteMessageBatch': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await reply.status(400).send({
                __type: 'AWS.SimpleQueueService.NonExistentQueue',
                message: 'The specified queue does not exist.',
              });
            }
            const handles = new Set(body.Entries.map((e: any) => e.ReceiptHandle));
            queue.messages = queue.messages.filter(m => !handles.has(m.ReceiptHandle));
            return {
              Successful: body.Entries.map((e: any) => ({ Id: e.Id })),
              Failed: [],
            };
          }
          case 'SendMessageBatch': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await reply.status(400).send({
                __type: 'AWS.SimpleQueueService.NonExistentQueue',
                message: 'The specified queue does not exist.',
              });
            }
            const results = body.Entries.map((entry: any) => {
              const message = enqueueMessage(queue, entry.MessageBody);
              return {
                Id: entry.Id,
                MessageId: message.MessageId,
                MD5OfMessageBody: message.MD5OfBody,
              };
            });
            return { Successful: results, Failed: [] };
          }
          default:
            return await reply.status(400).send({
              __type: 'UnsupportedOperation',
              message: `Action ${action} is not supported`,
            });
        }
      } catch (err: any) {
        return reply
          .status(500)
          .send({ __type: 'ServiceException', message: err.message });
      }
    }

    // ---- Query protocol handler (@aws-sdk/client-sqs v3 <= 3.679.0) ----
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const action = body.Action as string | undefined;
      if (!action) {
        return reply
          .status(400)
          .type('application/xml')
          .send(
            `<ErrorResponse><Error><Code>MissingAction</Code><Message>Missing Action parameter</Message></Error><RequestId>${randomUUID()}</RequestId></ErrorResponse>`,
          );
      }

      const ns = 'http://queue.amazonaws.com/doc/2012-11-05/';

      const xmlOk = (responseName: string, inner: string) =>
        reply
          .status(200)
          .type('application/xml')
          .send(
            `<${responseName}Response xmlns="${ns}"><${responseName}Result>${inner}</${responseName}Result><ResponseMetadata><RequestId>${randomUUID()}</RequestId></ResponseMetadata></${responseName}Response>`,
          );

      const xmlVoid = (responseName: string) =>
        reply
          .status(200)
          .type('application/xml')
          .send(
            `<${responseName}Response xmlns="${ns}"><ResponseMetadata><RequestId>${randomUUID()}</RequestId></ResponseMetadata></${responseName}Response>`,
          );

      const xmlError = (code: string, message: string, status = 400) =>
        reply
          .status(status)
          .type('application/xml')
          .send(
            `<ErrorResponse><Error><Code>${xmlEscape(code)}</Code><Message>${xmlEscape(
              message,
            )}</Message></Error><RequestId>${randomUUID()}</RequestId></ErrorResponse>`,
          );

      try {
        switch (action) {
          case 'CreateQueue': {
            const { QueueName } = body;
            if (!queues.has(QueueName)) {
              queues.set(QueueName, { messages: [] });
            }
            return await xmlOk(
              'CreateQueue',
              `<QueueUrl>${xmlEscape(buildQueueUrl(host, QueueName))}</QueueUrl>`,
            );
          }
          case 'GetQueueUrl': {
            const { QueueName } = body;
            if (!queues.has(QueueName)) {
              return await xmlError(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            return await xmlOk(
              'GetQueueUrl',
              `<QueueUrl>${xmlEscape(buildQueueUrl(host, QueueName))}</QueueUrl>`,
            );
          }
          case 'DeleteQueue': {
            queues.delete(getQueueName(body.QueueUrl));
            return await xmlVoid('DeleteQueue');
          }
          case 'SendMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await xmlError(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const message = enqueueMessage(queue, body.MessageBody);
            return await xmlOk(
              'SendMessage',
              `<MessageId>${message.MessageId}</MessageId><MD5OfMessageBody>${message.MD5OfBody}</MD5OfMessageBody>`,
            );
          }
          case 'ReceiveMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await xmlError(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const maxMessages = Math.min(
              parseInt(body.MaxNumberOfMessages ?? '1', 10),
              10,
            );
            const visibilityTimeoutMs =
              parseInt(body.VisibilityTimeout ?? '30', 10) * 1000;
            const picked = pickMessages(queue, maxMessages, visibilityTimeoutMs);
            if (picked.length === 0) {
              return await xmlOk('ReceiveMessage', '');
            }
            const messagesXml = picked
              .map(
                m =>
                  `<Message><MessageId>${m.MessageId}</MessageId><ReceiptHandle>${
                    m.ReceiptHandle
                  }</ReceiptHandle><MD5OfBody>${m.MD5OfBody}</MD5OfBody><Body>${xmlEscape(
                    m.Body,
                  )}</Body></Message>`,
              )
              .join('');
            return await xmlOk('ReceiveMessage', messagesXml);
          }
          case 'DeleteMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await xmlError(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            queue.messages = queue.messages.filter(
              m => m.ReceiptHandle !== body.ReceiptHandle,
            );
            return await xmlVoid('DeleteMessage');
          }
          case 'DeleteMessageBatch': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await xmlError(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const entries = parseIndexedParams(body, 'DeleteMessageBatchRequestEntry');
            const handles = new Set(entries.map(e => e.ReceiptHandle));
            queue.messages = queue.messages.filter(m => !handles.has(m.ReceiptHandle));
            const successXml = entries
              .map(
                e =>
                  `<DeleteMessageBatchResultEntry><Id>${xmlEscape(
                    e.Id,
                  )}</Id></DeleteMessageBatchResultEntry>`,
              )
              .join('');
            return await xmlOk('DeleteMessageBatch', successXml);
          }
          case 'SendMessageBatch': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return await xmlError(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const entries = parseIndexedParams(body, 'SendMessageBatchRequestEntry');
            const successXml = entries
              .map(entry => {
                const message = enqueueMessage(queue, entry.MessageBody);
                return `<SendMessageBatchResultEntry><Id>${xmlEscape(
                  entry.Id,
                )}</Id><MessageId>${message.MessageId}</MessageId><MD5OfMessageBody>${
                  message.MD5OfBody
                }</MD5OfMessageBody></SendMessageBatchResultEntry>`;
              })
              .join('');
            return await xmlOk('SendMessageBatch', successXml);
          }
          case 'PurgeQueue': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (queue) {
              queue.messages = [];
            }
            return await xmlVoid('PurgeQueue');
          }
          default:
            return await xmlError(
              'UnsupportedOperation',
              `Action ${action} is not supported`,
            );
        }
      } catch (err: any) {
        return xmlError('ServiceException', err.message, 500);
      }
    }

    return reply.status(415).send({ message: 'Unsupported Media Type' });
  });

  return app;
};

export const setupTestQueues = (queueNames: string[]) => {
  const sqsService = createJsonSqsServer();
  const sqsClient = new SQS({
    endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
  });
  beforeAll(() => sqsService.listen({ port: parseInt(process.env.LOCAL_SQS_PORT!) }));
  afterAll(() => sqsService.close());
  beforeEach(async () => {
    await Promise.all(
      queueNames.map(async queueName =>
        sqsClient
          .createQueue({
            QueueName: queueName,
          })
          .promise(),
      ),
    );
  });
  afterEach(async () => {
    await Promise.allSettled(
      queueNames.map(async queueName => {
        try {
          const resp = await sqsClient
            .getQueueUrl({
              QueueName: queueName,
            })
            .promise();
          const testQueueUrl = resp.QueueUrl;
          await sqsClient
            .deleteQueue({
              QueueUrl: testQueueUrl!.toString(),
            })
            .promise();
        } catch (err) {
          console.error(
            expect.getState().currentTestName,
            '\nError deleting queue',
            queueName,
            err,
          );
        }
      }),
    );
  });
  return {
    sqsService,
    sqsClient,
  };
};
