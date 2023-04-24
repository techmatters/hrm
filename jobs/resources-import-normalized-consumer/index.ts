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

import { ResourceImportProcessorError } from '@tech-matters/hrm-job-errors';
import fetch from 'node-fetch';
import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';
// import { SQS } from 'aws-sdk';
// eslint-disable-next-line prettier/prettier
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
// eslint-disable-next-line prettier/prettier
import type { ImportRequestBody } from '@tech-matters/types';

const internalResourcesBaseUrl = process.env.internal_resources_base_url as string;
const hrmEnv = process.env.NODE_ENV;

const postNormalizedResourcesBody = async (accountSid: string, apiKey: string, message: ImportRequestBody) => {
    const url = `https://${internalResourcesBaseUrl}/v0/accounts/${accountSid}/resources/import`;

    const options = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // 'Authentication': `Basic ${apiKey}`,
      },
      body: JSON.stringify(message),
    };
    const response = await fetch(url, options);
    return response;
};

const upsertRecord = async (message: ImportRequestBody): Promise<void> => {
  const { accountSid } = message;
  const apiKey = await getSsmParameter(`/${hrmEnv}/twilio/${message.accountSid}/static_key`);

  const result = await postNormalizedResourcesBody(accountSid, apiKey, message);

  if (!result.ok) {
    const error = await result.json();
    // throw so the wrapper function catches and swallows this error
    throw new Error(error);
  }
};

type ProcessedResult = {
  status: 'successs';
  messageId: SQSRecord['messageId'];
} | {
  status: 'failure';
  messageId: SQSRecord['messageId'];
  reason: Error;
};

const upsertRecordWithoutException = async (sqsRecord: SQSRecord): Promise<ProcessedResult> => {
  const message = JSON.parse(sqsRecord.body);

  try {
    await upsertRecord(message);

    return {
      status: 'successs',
      messageId: sqsRecord.messageId, 
    };
  } catch (err) {
    console.error(new ResourceImportProcessorError('Failed to process record'), err);

    const errMessage = err instanceof Error ? err.message : String(err);

    // TODO: Handle this (DLQ required)
    // const failedJob = { ... };
    // await sqs
    //   .sendMessage({
    //     MessageBody: JSON.stringify(failedJob),
    //     QueueUrl: completedQueueUrl,
    //   })
    //   .promise();

    return {
      status: 'failure',
      messageId: sqsRecord.messageId, 
      reason: new Error(errMessage),
    };
  }
};

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailuresSet: Set<string> = new Set();

  try {
    if (!internalResourcesBaseUrl) {
      throw new Error('Missing completed_sqs_queue_url ENV Variable');
    }

    if (!hrmEnv) {
      throw new Error('Missing NODE_ENV ENV Variable');
    }

    // This assumes messages are posted in the correct order by the producer
    // Syncronously wait for each message to be processed since order matters here
    for (const sqsRecord of event.Records) {
      const processed = await upsertRecordWithoutException(sqsRecord);

      if (processed.status === 'failure') {
        batchItemFailuresSet.add(processed.messageId);
      }
    }

    const response: SQSBatchResponse = { batchItemFailures: Array.from(batchItemFailuresSet).map(messageId => ({
      itemIdentifier: messageId,
    })), 
    };
    return response;
  } catch (err) {
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    console.error(new ResourceImportProcessorError('Failed to init processor'), err);

    const response: SQSBatchResponse = { batchItemFailures: event.Records.map(record => ({
      itemIdentifier: record.messageId,
    })) };
    return response;
  }
};
