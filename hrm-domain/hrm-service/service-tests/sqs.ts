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
 * Creates an in-memory Fastify server that handles the JSON SQS protocol
 * (Content-Type: application/x-amz-json-1.0) used by aws-sdk >= 2.1491.0
 * and @aws-sdk/client-sqs (v3).
 *
 * This replaces sqslite for tests that require JSON protocol support.
 * sqslite only supports the legacy Query protocol (application/x-www-form-urlencoded),
 * which is no longer used by aws-sdk starting from version 2.1491.0.
 */
export const createJsonSqsServer = () => {
  const queues = new Map<string, Queue>();

  const getQueueName = (queueUrl: string): string => {
    const urlPath = queueUrl.split('/');
    return urlPath[urlPath.length - 1];
  };

  const buildQueueUrl = (host: string, queueName: string): string =>
    `http://${host}/queues/${queueName}`;

  const app = Fastify({ logger: false });

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

  app.post('/', async (request, reply) => {
    const target = request.headers['x-amz-target'] as string | undefined;
    if (!target) {
      return reply.status(400).send({ __type: 'MissingAction', message: 'Missing X-Amz-Target header' });
    }

    const action = target.split('.').pop()!;
    const body = request.body as Record<string, any>;
    const host = (request.headers.host as string) ?? `localhost:${process.env.LOCAL_SQS_PORT}`;

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
            return reply.status(400).send({
              __type: 'AWS.SimpleQueueService.NonExistentQueue',
              message: 'The specified queue does not exist.',
            });
          }
          return { QueueUrl: buildQueueUrl(host, QueueName) };
        }
        case 'DeleteQueue': {
          const queueName = getQueueName(body.QueueUrl);
          queues.delete(queueName);
          return {};
        }
        case 'SendMessage': {
          const queueName = getQueueName(body.QueueUrl);
          const queue = queues.get(queueName);
          if (!queue) {
            return reply.status(400).send({
              __type: 'AWS.SimpleQueueService.NonExistentQueue',
              message: 'The specified queue does not exist.',
            });
          }
          const messageBody = String(body.MessageBody);
          const message: Message = {
            MessageId: randomUUID(),
            ReceiptHandle: randomUUID(),
            Body: messageBody,
            MD5OfBody: createHash('md5').update(messageBody).digest('hex'),
            Attributes: {},
            MessageAttributes: body.MessageAttributes ?? {},
            visibleAfter: 0,
          };
          queue.messages.push(message);
          return { MessageId: message.MessageId, MD5OfMessageBody: message.MD5OfBody };
        }
        case 'ReceiveMessage': {
          const queueName = getQueueName(body.QueueUrl);
          const queue = queues.get(queueName);
          if (!queue) {
            return reply.status(400).send({
              __type: 'AWS.SimpleQueueService.NonExistentQueue',
              message: 'The specified queue does not exist.',
            });
          }
          const now = Date.now();
          const maxMessages = Math.min(body.MaxNumberOfMessages ?? 1, 10);
          const visibilityTimeout = (body.VisibilityTimeout ?? 30) * 1000;
          const available = queue.messages.filter(m => m.visibleAfter <= now);
          const picked = available.slice(0, maxMessages);
          const newVisibleAfter = now + visibilityTimeout;
          picked.forEach(m => {
            m.visibleAfter = newVisibleAfter;
            m.ReceiptHandle = randomUUID();
          });
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
          const queueName = getQueueName(body.QueueUrl);
          const queue = queues.get(queueName);
          if (!queue) {
            return reply.status(400).send({
              __type: 'AWS.SimpleQueueService.NonExistentQueue',
              message: 'The specified queue does not exist.',
            });
          }
          queue.messages = queue.messages.filter(m => m.ReceiptHandle !== body.ReceiptHandle);
          return {};
        }
        case 'DeleteMessageBatch': {
          const queueName = getQueueName(body.QueueUrl);
          const queue = queues.get(queueName);
          if (!queue) {
            return reply.status(400).send({
              __type: 'AWS.SimpleQueueService.NonExistentQueue',
              message: 'The specified queue does not exist.',
            });
          }
          const handles = new Set(body.Entries.map((e: any) => e.ReceiptHandle));
          queue.messages = queue.messages.filter(m => !handles.has(m.ReceiptHandle));
          return { Successful: body.Entries.map((e: any) => ({ Id: e.Id })), Failed: [] };
        }
        case 'SendMessageBatch': {
          const queueName = getQueueName(body.QueueUrl);
          const queue = queues.get(queueName);
          if (!queue) {
            return reply.status(400).send({
              __type: 'AWS.SimpleQueueService.NonExistentQueue',
              message: 'The specified queue does not exist.',
            });
          }
          const results = body.Entries.map((entry: any) => {
            const messageBody = String(entry.MessageBody);
            const message: Message = {
              MessageId: randomUUID(),
              ReceiptHandle: randomUUID(),
              Body: messageBody,
              MD5OfBody: createHash('md5').update(messageBody).digest('hex'),
              Attributes: {},
              MessageAttributes: entry.MessageAttributes ?? {},
              visibleAfter: 0,
            };
            queue.messages.push(message);
            return { Id: entry.Id, MessageId: message.MessageId, MD5OfMessageBody: message.MD5OfBody };
          });
          return { Successful: results, Failed: [] };
        }
        default:
          return reply.status(400).send({
            __type: 'UnsupportedOperation',
            message: `Action ${action} is not supported`,
          });
      }
    } catch (err: any) {
      return reply.status(500).send({ __type: 'ServiceException', message: err.message });
    }
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
              QueueUrl: testQueueUrl.toString(),
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

