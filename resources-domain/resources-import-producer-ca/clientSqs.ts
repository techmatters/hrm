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

import { SQS } from 'aws-sdk';

// eslint-disable-next-line prettier/prettier
import type { ImportRequestBody } from '@tech-matters/types';
// eslint-disable-next-line prettier/prettier
import type { AccountSID } from '@tech-matters/twilio-worker-auth';


let sqs: SQS;

const getSqsClient = () => {
  if (!sqs) {
    sqs = new SQS();
  }
  return sqs;
};

export const publishToImportConsumer = (importResourcesSqsQueueUrl: URL) => async (params: ResourceMessage) => {
  //TODO: more robust error handling/messaging
  try {
    const QueueUrl = importResourcesSqsQueueUrl.toString();

    return await getSqsClient()
      .sendMessage({
        MessageBody: JSON.stringify(params),
        QueueUrl,
      })
      .promise();
  } catch (err) {
    console.error('Error trying to send message to SQS queue', err);
  }
};
export type ResourceMessage = ImportRequestBody & { accountSid: AccountSID };