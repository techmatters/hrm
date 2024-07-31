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
import { sendSqsMessage } from '@tech-matters/sqs-client';
import { putS3Object } from '@tech-matters/s3-client';

import { ContactJobProcessorError } from '@tech-matters/job-errors';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import {
  ContactJobAttemptResult,
  ContactJobType,
  PublishRetrieveContactTranscript,
} from '@tech-matters/types';
import { exportTranscript } from './exportTranscript';

import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import type {
  CompletedContactJobBody,
  PublishToContactJobsTopicParams,
} from '@tech-matters/types';

const completedQueueUrl = process.env.completed_sqs_queue_url as string;
const hrmEnv = process.env.NODE_ENV;

// # used for ssm-cache.LoadSsmCache() call. Leaving here for now in case we need it later. (rbd Mar 9 2023)
// const ssmCacheConfigs = [
//   {
//     path: `/${hrmEnv}/twilio/`,
//     regex: /auth_token/,
//   },
//   {
//     path: `/${hrmEnv}/s3/`,
//     regex: /docs_bucket_name/,
//   },
// ];

const processRetrieveTranscriptRecord = async (
  message: PublishRetrieveContactTranscript,
) => {
  const authToken = await getSsmParameter(
    `/${hrmEnv}/twilio/${message.accountSid}/auth_token`,
  );
  const docsBucketName = await getSsmParameter(
    `/${hrmEnv}/s3/${message.accountSid}/docs_bucket_name`,
  );

  if (!authToken || !docsBucketName) {
    console.log('Missing required SSM params');
    throw new Error('Missing required SSM params');
  }

  const { accountSid, channelSid, serviceSid, contactId, taskId, twilioWorkerId } =
    message;

  const transcript = await exportTranscript({
    authToken,
    accountSid,
    channelSid,
    serviceSid,
  });

  await putS3Object({
    bucket: docsBucketName,
    key: message.filePath,
    body: JSON.stringify({
      transcript,
      accountSid,
      contactId,
      taskId,
      twilioWorkerId,
      serviceSid,
      channelSid,
    }),
  });

  const completedJob: CompletedContactJobBody = {
    ...message,
    attemptResult: ContactJobAttemptResult.SUCCESS,
    attemptPayload: {
      bucket: docsBucketName,
      key: message.filePath,
    },
  };

  await sendSqsMessage({
    queueUrl: completedQueueUrl,
    message: JSON.stringify(completedJob),
  });
};

export const processRecordWithoutException = async (
  sqsRecord: SQSRecord,
): Promise<void> => {
  const message = JSON.parse(sqsRecord.body);
  try {
    if (message.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT) {
      await processRetrieveTranscriptRecord(message);
    }
  } catch (err) {
    console.error(new ContactJobProcessorError('Failed to process record'), err);

    const errMessage = err instanceof Error ? err.message : String(err);

    const failedJob: CompletedContactJobBody = {
      ...message,
      attemptResult: ContactJobAttemptResult.FAILURE,
      attemptPayload: errMessage,
    };

    console.log('Sending failed job to completed queue', failedJob);

    await sendSqsMessage({
      queueUrl: completedQueueUrl,
      message: JSON.stringify(failedJob),
    });
  }
};

export const handler = async (event: SQSEvent): Promise<any> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };

  try {
    if (!completedQueueUrl) {
      throw new Error('Missing completed_sqs_queue_url ENV Variable');
    }

    if (!hrmEnv) {
      throw new Error('Missing NODE_ENV ENV Variable');
    }

    const promises = event.Records.map(async sqsRecord =>
      processRecordWithoutException(sqsRecord),
    );

    await Promise.all(promises);
  } catch (err) {
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    console.error(new ContactJobProcessorError('Failed to init processor'), err);

    // We fail all messages here and rely on SQS retry/DLQ because we hit
    // a fatal error before we could process any of the messages. The error
    // handler, whether loop based in hrm-services or lambda based here, will
    // need to be able to handle these messages that will end up in the completed
    // queue without a completionPayload.
    response.batchItemFailures = event.Records.map(record => {
      return {
        itemIdentifier: record.messageId,
      };
    });
  }

  return response;
};
