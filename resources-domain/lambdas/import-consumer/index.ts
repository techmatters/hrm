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

import { ResourceImportProcessorError } from '@tech-matters/job-errors';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import type { HrmAccountId } from '@tech-matters/types';
import type { FlatResource, ImportRequestBody } from '@tech-matters/resources-types';
import { retrieveMessageContent } from '@tech-matters/sqs-client';

const internalResourcesBaseUrl = process.env.internal_resources_base_url as string;
const hrmEnv = process.env.NODE_ENV;

const postResourcesBody = async (
  accountSid: string,
  apiKey: string,
  message: ImportRequestBody,
) => {
  const url = `${internalResourcesBaseUrl}/v0/accounts/${accountSid}/resources/import`;

  const options = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify(message),
  };

  // @ts-ignore global fetch available because node 18
  return fetch(url, options);
};

const upsertRecord = async (
  accountSid: HrmAccountId,
  body: ImportRequestBody,
): Promise<void> => {
  const apiKey = await getSsmParameter(`/${hrmEnv}/twilio/${accountSid}/static_key`);

  const result = await postResourcesBody(accountSid, apiKey, body);

  if (!result.ok) {
    const responseBody = await result.json();
    // throw so the wrapper function catches and swallows this error
    throw new Error(
      `Resources import POST returned ${result.status} (${
        result.statusText
      }). Response body: ${JSON.stringify(responseBody)}`,
    );
  }
};

type ProcessedResult =
  | {
      status: 'success';
      messageId: SQSRecord['messageId'];
    }
  | {
      status: 'failure';
      messageId: SQSRecord['messageId'];
      reason: Error;
    };

const upsertRecordWithoutException = async (
  sqsRecord: SQSRecord,
): Promise<ProcessedResult> => {
  const jsonBody = await retrieveMessageContent(sqsRecord.body, sqsRecord.messageId);
  const { accountSid, ...body } = JSON.parse(jsonBody);
  const resourceIds = body.importedResources.map((r: FlatResource) => r.id).join(', ');
  console.debug(
    `[Imported Resource Trace] Calling HRM to upsert ${accountSid}/${resourceIds}`,
    `Batch:`,
    body.batch,
  );
  try {
    await upsertRecord(accountSid, body);

    console.debug(
      `[Imported Resource Trace] Successfully called HRM to upsert ${accountSid}/${resourceIds}`,
      `Batch:`,
      body.batch,
    );
    return {
      status: 'success',
      messageId: sqsRecord.messageId,
    };
  } catch (err) {
    console.error(
      `[Imported Resource Trace] Error upserting ${accountSid}/${resourceIds}`,
      new ResourceImportProcessorError('Failed to process record'),
      err,
      `Batch:`,
      body.batch,
    );

    const errMessage = err instanceof Error ? err.message : String(err);

    return {
      status: 'failure',
      messageId: sqsRecord.messageId,
      reason: new Error(errMessage),
    };
  }
};

const newFailWholeBatchResponse = (event: SQSEvent, err: Error): SQSBatchResponse => {
  console.error('Failed to init processor', err);

  return {
    batchItemFailures: event.Records.map(record => ({
      itemIdentifier: record.messageId,
    })),
  };
};

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailuresSet: Set<string> = new Set();
  try {
    if (!internalResourcesBaseUrl) {
      return newFailWholeBatchResponse(
        event,
        new ResourceImportProcessorError(
          'Missing internal_resources_base_url ENV Variable',
        ),
      );
    }

    if (!hrmEnv) {
      return newFailWholeBatchResponse(
        event,
        new ResourceImportProcessorError('Missing NODE_ENV ENV Variable'),
      );
    }

    // This assumes messages are posted in the correct order by the producer
    // Synchronously wait for each message to be processed since order matters here
    for (const sqsRecord of event.Records) {
      const processed = await upsertRecordWithoutException(sqsRecord);

      if (processed.status === 'failure') {
        batchItemFailuresSet.add(processed.messageId);
      }
    }

    return {
      batchItemFailures: Array.from(batchItemFailuresSet).map(messageId => ({
        itemIdentifier: messageId,
      })),
    };
  } catch (err) {
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    return newFailWholeBatchResponse(event, err as Error);
  }
};
