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
import sqslite from 'sqslite';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';

export const setupTestQueues = (queueNames: string[]) => {
  const sqsService = sqslite({});
  const sqsClient = new SQS({
    endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
  });
  beforeAll(() => sqsService.listen({ port: parseInt(process.env.LOCAL_SQS_PORT!) }));
  afterAll(() => sqsService.close());
  beforeEach(async () => {
    console.debug(expect.getState().currentTestName, '\ncreating queues', queueNames);
    await Promise.all(
      queueNames.map(async queueName =>
        sqsClient
          .createQueue({
            QueueName: queueName,
          })
          .promise(),
      ),
    );
    console.debug(expect.getState().currentTestName, '\ncreated queues', queueNames);
  });
  afterEach(async () => {
    console.debug(expect.getState().currentTestName, '\ndeleting queues', queueNames);
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
    console.debug(expect.getState().currentTestName, '\ndeleted queues', queueNames);
  });
  return {
    sqsService,
    sqsClient,
  };
};
