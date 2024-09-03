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

import {
  deleteSqsMessage,
  receiveSqsMessage,
  sendSqsMessage,
} from '@tech-matters/sqs-client';
import { getSsmParameter } from '../config/ssmCache';

import type { PublishToContactJobsTopicParams } from '@tech-matters/types';
import { SsmParameterNotFound } from '@tech-matters/ssm-cache';

const COMPLETED_QUEUE_SSM_PATH = `/${process.env.NODE_ENV}/${
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
}/sqs/jobs/hrm-contact/queue-url-complete`;
const JOB_QUEUE_SSM_PATH_BASE = `/${process.env.NODE_ENV}/${
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
}/sqs/jobs/hrm-contact/queue-url-`;

export const pollCompletedContactJobsFromQueue = async (): ReturnType<
  typeof receiveSqsMessage
> => {
  try {
    const queueUrl = await getSsmParameter(COMPLETED_QUEUE_SSM_PATH);
    console.debug(
      `[contact-job] Polling messages from SQS queue: ${queueUrl}, looked up from SSM parameter: ${COMPLETED_QUEUE_SSM_PATH}`,
    );
    return await receiveSqsMessage({
      queueUrl,
      maxNumberOfMessages: 10,
      waitTimeSeconds: 0,
    });
  } catch (err) {
    console.error('Error trying to poll messages from SQS queue', err);
  }
};

export const deleteCompletedContactJobsFromQueue = async (receiptHandle: string) => {
  try {
    const queueUrl = await getSsmParameter(COMPLETED_QUEUE_SSM_PATH);

    return await deleteSqsMessage({
      queueUrl,
      receiptHandle,
    });
  } catch (err) {
    console.error('Error trying to delete message from SQS queue', err);
  }
};

export const publishToContactJobs = async (params: PublishToContactJobsTopicParams) => {
  //TODO: more robust error handling/messaging
  try {
    const queueUrl = await getSsmParameter(`${JOB_QUEUE_SSM_PATH_BASE}${params.jobType}`);

    const result = await sendSqsMessage({
      queueUrl,
      message: JSON.stringify(params),
    });
    console.info(
      `[contact-job](${params.accountSid}) Sent job ${params.jobType} / ${params.jobId}, contact ${params.contactId}`,
    );
    return result;
  } catch (err) {
    if (err instanceof SsmParameterNotFound) {
      console.warn(
        `[contact-job](${params.accountSid}) SSM parameter for ${params.jobType} not found, assuming this job type is not enabled for this environment. Job ${params.jobType} / ${params.jobId}, contact ${params.contactId}`,
      );
      return;
    }
    console.error(
      `[contact-job](${params?.accountSid}) Error trying to send message to SQS queue. Job ${params?.jobType} / ${params?.jobId}, contact ${params?.contactId}`,
      err,
    );
  }
};
