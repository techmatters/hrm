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
import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';

// eslint-disable-next-line prettier/prettier
import type { ResourcesSearchIndexPayload } from '@tech-matters/types';

let sqs: SQS;

export const getSqsClient = () => {
  if (!sqs) {
    sqs = new SQS();
  }
  return sqs;
};

const getJobQueueUrl = (accountSid: string, jobType: string) => `/${process.env.NODE_ENV}/resources/${accountSid}/queue-url-${jobType}`;

export const publishToResourcesJob = async (params: ResourcesSearchIndexPayload) => {
  //TODO: more robust error handling/messaging
  try {
    const QueueUrl = await getSsmParameter(
      getJobQueueUrl(params.accountSid, 'contact'),
    );

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
