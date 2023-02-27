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
import { getSsmParameter } from '../config/ssmCache';

// eslint-disable-next-line prettier/prettier
import type { PublishToContactJobsTopicParams } from '@tech-matters/hrm-types/ContactJob';

let sqs: SQS;

const COMPLETED_QUEUE_SSM_PATH = `/${process.env.NODE_ENV}/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/sqs/jobs/contact/queue-url-complete`;
const JOB_QUEUE_SSM_PATH_BASE = `/${process.env.NODE_ENV}/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/sqs/jobs/contact/queue-url`;


export const getSqsClient = () => {
  if (!sqs) {
    sqs = new SQS();
  }
  return sqs;
};

export const pollCompletedContactJobsFromQueue =
  async (): Promise<SQS.Types.ReceiveMessageResult> => {
    try {
      const QueueUrl = getSsmParameter(COMPLETED_QUEUE_SSM_PATH);

      return await getSqsClient()
        .receiveMessage({
          QueueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 0,
        })
        .promise();
    } catch (err) {
      console.error('Error trying to poll messages from SQS queue', err);
    }
  };

export const deleteCompletedContactJobsFromQueue = async (ReceiptHandle: string) => {
  try {
    const QueueUrl = getSsmParameter(COMPLETED_QUEUE_SSM_PATH);

    return await getSqsClient().deleteMessage({ QueueUrl, ReceiptHandle }).promise();
  } catch (err) {
    console.error('Error trying to delete message from SQS queue', err);
  }
};

export const publishToContactJobs = async (params: PublishToContactJobsTopicParams) => {

  //TODO: more robust error handling/messaging
  try {
    const QueueUrl = getSsmParameter(
      `${JOB_QUEUE_SSM_PATH_BASE}${params.jobType}`,
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
