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
import type { Mockttp } from 'mockttp';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import { createHash, randomUUID } from 'crypto';
import { mockttpServer } from './mocking-proxy';

/**
 * The hostname used by the in-memory SQS mock. The Mockttp proxy intercepts
 * all HTTP requests to this host, so the SQS_ENDPOINT environment variable
 * must be set to this value for the application under test to use this mock.
 */
export const MOCK_SQS_ENDPOINT = 'http://mock-sqs';

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

// Module-level queue state, shared within the same process (one per Jest worker).
// Queues are created/deleted via the SQS API, providing test isolation when
// each test creates its own named queue in beforeEach and deletes it in afterEach.
const queues = new Map<string, Queue>();

// Guard flag so the Mockttp handler is only registered once per process.
let handlerRegistered = false;

const getQueueName = (queueUrl: string): string => {
  const parts = queueUrl.split('/');
  return parts[parts.length - 1];
};

const buildQueueUrl = (queueName: string): string =>
  `${MOCK_SQS_ENDPOINT}/queues/${queueName}`;

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

const pickMessages = (queue: Queue, maxMessages: number, visibilityTimeoutMs: number) => {
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

// --- Response helpers ---

const NS = 'http://queue.amazonaws.com/doc/2012-11-05/';

const xmlOkResponse = (responseName: string, inner: string) => ({
  statusCode: 200,
  headers: { 'content-type': 'application/xml' },
  body: `<${responseName}Response xmlns="${NS}"><${responseName}Result>${inner}</${responseName}Result><ResponseMetadata><RequestId>${randomUUID()}</RequestId></ResponseMetadata></${responseName}Response>`,
});

const xmlVoidResponse = (responseName: string) => ({
  statusCode: 200,
  headers: { 'content-type': 'application/xml' },
  body: `<${responseName}Response xmlns="${NS}"><ResponseMetadata><RequestId>${randomUUID()}</RequestId></ResponseMetadata></${responseName}Response>`,
});

const xmlErrorResponse = (code: string, message: string, statusCode = 400) => ({
  statusCode,
  headers: { 'content-type': 'application/xml' },
  body: `<ErrorResponse><Error><Code>${xmlEscape(code)}</Code><Message>${xmlEscape(message)}</Message></Error><RequestId>${randomUUID()}</RequestId></ErrorResponse>`,
});

const jsonResponse = (body: Record<string, unknown>, statusCode = 200) => ({
  statusCode,
  headers: { 'content-type': 'application/x-amz-json-1.0' },
  body: JSON.stringify(body),
});

/**
 * Registers an in-memory SQS mock handler with the provided Mockttp instance.
 *
 * Intercepts all POST requests to http://mock-sqs and handles them in-memory,
 * supporting both:
 * - the JSON protocol (Content-Type: application/x-amz-json-1.0), used by
 *   aws-sdk v2 >= 2.1491.0
 * - the Query protocol (Content-Type: application/x-www-form-urlencoded), used
 *   by @aws-sdk/client-sqs v3
 *
 * The SQS_ENDPOINT environment variable must be set to MOCK_SQS_ENDPOINT
 * ('http://mock-sqs') for the application under test to route its SQS calls
 * through this mock.
 *
 * The handler is registered only once per process; subsequent calls are no-ops.
 */
export const mockSqs = async (mockttp: Mockttp): Promise<void> => {
  if (handlerRegistered) return;
  handlerRegistered = true;

  await mockttp
    .forPost(/http:\/\/mock-sqs(.*)/)
    .always()
    .thenCallback(async req => {
      const contentType = (req.headers['content-type'] as string) ?? '';

      // ---- JSON protocol (aws-sdk v2 >= 2.1491.0) ----
      if (contentType.includes('application/x-amz-json-1.0')) {
        const target = req.headers['x-amz-target'] as string | undefined;
        if (!target) {
          return jsonResponse(
            { __type: 'MissingAction', message: 'Missing X-Amz-Target header' },
            400,
          );
        }
        const action = target.split('.').pop()!;
        const body = (await req.body.getJson()) as Record<string, any>;

        switch (action) {
          case 'CreateQueue': {
            const { QueueName } = body;
            if (!queues.has(QueueName)) queues.set(QueueName, { messages: [] });
            return jsonResponse({ QueueUrl: buildQueueUrl(QueueName) });
          }
          case 'GetQueueUrl': {
            const { QueueName } = body;
            if (!queues.has(QueueName)) {
              return jsonResponse(
                {
                  __type: 'AWS.SimpleQueueService.NonExistentQueue',
                  message: 'The specified queue does not exist.',
                },
                400,
              );
            }
            return jsonResponse({ QueueUrl: buildQueueUrl(QueueName) });
          }
          case 'DeleteQueue': {
            queues.delete(getQueueName(body.QueueUrl));
            return jsonResponse({});
          }
          case 'SendMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return jsonResponse(
                {
                  __type: 'AWS.SimpleQueueService.NonExistentQueue',
                  message: 'The specified queue does not exist.',
                },
                400,
              );
            }
            const message = enqueueMessage(queue, body.MessageBody);
            return jsonResponse({
              MessageId: message.MessageId,
              MD5OfMessageBody: message.MD5OfBody,
            });
          }
          case 'ReceiveMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return jsonResponse(
                {
                  __type: 'AWS.SimpleQueueService.NonExistentQueue',
                  message: 'The specified queue does not exist.',
                },
                400,
              );
            }
            const maxMessages = Math.min(body.MaxNumberOfMessages ?? 1, 10);
            const visibilityTimeoutMs = (body.VisibilityTimeout ?? 30) * 1000;
            const picked = pickMessages(queue, maxMessages, visibilityTimeoutMs);
            return jsonResponse({
              Messages: picked.map(m => ({
                MessageId: m.MessageId,
                ReceiptHandle: m.ReceiptHandle,
                MD5OfBody: m.MD5OfBody,
                Body: m.Body,
                Attributes: m.Attributes,
                MessageAttributes: m.MessageAttributes,
              })),
            });
          }
          case 'DeleteMessage': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return jsonResponse(
                {
                  __type: 'AWS.SimpleQueueService.NonExistentQueue',
                  message: 'The specified queue does not exist.',
                },
                400,
              );
            }
            queue.messages = queue.messages.filter(
              m => m.ReceiptHandle !== body.ReceiptHandle,
            );
            return jsonResponse({});
          }
          case 'DeleteMessageBatch': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return jsonResponse(
                {
                  __type: 'AWS.SimpleQueueService.NonExistentQueue',
                  message: 'The specified queue does not exist.',
                },
                400,
              );
            }
            const handles = new Set(body.Entries.map((e: any) => e.ReceiptHandle));
            queue.messages = queue.messages.filter(m => !handles.has(m.ReceiptHandle));
            return jsonResponse({
              Successful: body.Entries.map((e: any) => ({ Id: e.Id })),
              Failed: [],
            });
          }
          case 'SendMessageBatch': {
            const queue = queues.get(getQueueName(body.QueueUrl));
            if (!queue) {
              return jsonResponse(
                {
                  __type: 'AWS.SimpleQueueService.NonExistentQueue',
                  message: 'The specified queue does not exist.',
                },
                400,
              );
            }
            const results = body.Entries.map((entry: any) => {
              const message = enqueueMessage(queue, entry.MessageBody);
              return {
                Id: entry.Id,
                MessageId: message.MessageId,
                MD5OfMessageBody: message.MD5OfBody,
              };
            });
            return jsonResponse({ Successful: results, Failed: [] });
          }
          default:
            return jsonResponse(
              { __type: 'UnsupportedOperation', message: `Action ${action} is not supported` },
              400,
            );
        }
      }

      // ---- Query protocol (@aws-sdk/client-sqs v3) ----
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const bodyText = await req.body.getText();
        const params: Record<string, string> = {};
        new URLSearchParams(bodyText ?? '').forEach((value, key) => {
          params[key] = value;
        });
        const action = params.Action;
        if (!action) {
          return xmlErrorResponse('MissingAction', 'Missing Action parameter');
        }

        switch (action) {
          case 'CreateQueue': {
            const { QueueName } = params;
            if (!queues.has(QueueName)) queues.set(QueueName, { messages: [] });
            return xmlOkResponse(
              'CreateQueue',
              `<QueueUrl>${xmlEscape(buildQueueUrl(QueueName))}</QueueUrl>`,
            );
          }
          case 'GetQueueUrl': {
            const { QueueName } = params;
            if (!queues.has(QueueName)) {
              return xmlErrorResponse(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            return xmlOkResponse(
              'GetQueueUrl',
              `<QueueUrl>${xmlEscape(buildQueueUrl(QueueName))}</QueueUrl>`,
            );
          }
          case 'DeleteQueue': {
            queues.delete(getQueueName(params.QueueUrl));
            return xmlVoidResponse('DeleteQueue');
          }
          case 'SendMessage': {
            const queue = queues.get(getQueueName(params.QueueUrl));
            if (!queue) {
              return xmlErrorResponse(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const message = enqueueMessage(queue, params.MessageBody);
            return xmlOkResponse(
              'SendMessage',
              `<MessageId>${message.MessageId}</MessageId><MD5OfMessageBody>${message.MD5OfBody}</MD5OfMessageBody>`,
            );
          }
          case 'ReceiveMessage': {
            const queue = queues.get(getQueueName(params.QueueUrl));
            if (!queue) {
              return xmlErrorResponse(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const maxMessages = Math.min(
              parseInt(params.MaxNumberOfMessages ?? '1', 10),
              10,
            );
            const visibilityTimeoutMs =
              parseInt(params.VisibilityTimeout ?? '30', 10) * 1000;
            const picked = pickMessages(queue, maxMessages, visibilityTimeoutMs);
            if (picked.length === 0) return xmlOkResponse('ReceiveMessage', '');
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
            return xmlOkResponse('ReceiveMessage', messagesXml);
          }
          case 'DeleteMessage': {
            const queue = queues.get(getQueueName(params.QueueUrl));
            if (!queue) {
              return xmlErrorResponse(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            queue.messages = queue.messages.filter(
              m => m.ReceiptHandle !== params.ReceiptHandle,
            );
            return xmlVoidResponse('DeleteMessage');
          }
          case 'DeleteMessageBatch': {
            const queue = queues.get(getQueueName(params.QueueUrl));
            if (!queue) {
              return xmlErrorResponse(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const entries = parseIndexedParams(
              params,
              'DeleteMessageBatchRequestEntry',
            );
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
            return xmlOkResponse('DeleteMessageBatch', successXml);
          }
          case 'SendMessageBatch': {
            const queue = queues.get(getQueueName(params.QueueUrl));
            if (!queue) {
              return xmlErrorResponse(
                'AWS.SimpleQueueService.NonExistentQueue',
                'The specified queue does not exist.',
              );
            }
            const entries = parseIndexedParams(params, 'SendMessageBatchRequestEntry');
            const successXml = entries
              .map(entry => {
                const message = enqueueMessage(queue, entry.MessageBody);
                return `<SendMessageBatchResultEntry><Id>${xmlEscape(
                  entry.Id,
                )}</Id><MessageId>${
                  message.MessageId
                }</MessageId><MD5OfMessageBody>${
                  message.MD5OfBody
                }</MD5OfMessageBody></SendMessageBatchResultEntry>`;
              })
              .join('');
            return xmlOkResponse('SendMessageBatch', successXml);
          }
          case 'PurgeQueue': {
            const queue = queues.get(getQueueName(params.QueueUrl));
            if (queue) queue.messages = [];
            return xmlVoidResponse('PurgeQueue');
          }
          default:
            return xmlErrorResponse(
              'UnsupportedOperation',
              `Action ${action} is not supported`,
            );
        }
      }

      return { statusCode: 415, body: JSON.stringify({ message: 'Unsupported Media Type' }) };
    });
};

/**
 * Sets up Jest lifecycle hooks to create and delete the named SQS queues
 * around each test, using the in-memory Mockttp-based SQS mock.
 *
 * Calls mockSqs() in a beforeAll hook so it is safe to call this helper at
 * module level; the Mockttp handler registration is deferred until Jest starts
 * executing (by which point mockingProxy.start() will already have run).
 */
export const setupTestQueues = (queueNames: string[]) => {
  const sqsClient = new SQS({ endpoint: MOCK_SQS_ENDPOINT });

  beforeAll(async () => {
    const server = await mockttpServer();
    await mockSqs(server);
  });

  beforeEach(async () => {
    await Promise.all(
      queueNames.map(queueName =>
        sqsClient.createQueue({ QueueName: queueName }).promise(),
      ),
    );
  });

  afterEach(async () => {
    await Promise.allSettled(
      queueNames.map(async queueName => {
        try {
          const { QueueUrl } = await sqsClient
            .getQueueUrl({ QueueName: queueName })
            .promise();
          await sqsClient.deleteQueue({ QueueUrl: QueueUrl!.toString() }).promise();
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

  return { sqsClient };
};
