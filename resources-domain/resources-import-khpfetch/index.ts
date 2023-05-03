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
import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';
// import { SQS } from 'aws-sdk';
// eslint-disable-next-line prettier/prettier
import type { ScheduledEvent, SQSBatchResponse, SQSRecord } from 'aws-lambda';
import { ImportProgress } from '@tech-matters/types';
import { AccountSID } from '@tech-matters/twilio-worker-auth/dist';
// eslint-disable-next-line prettier/prettier

const internalResourcesBaseUrl = new URL(process.env.internal_resources_base_url ?? '');
const hrmEnv = process.env.NODE_ENV;

type HttpError<T = any> = {
  status: number;
  statusText: string;
  body: T;
}

const retrieveCurrentStatus = async (accountSid: AccountSID): Promise<ImportProgress | HttpError> => {
  const response  = await fetch(`${internalResourcesBaseUrl}/v0/accounts/${accountSid}/resources/import/progress`, {});
  if (response.ok) {
    return response.json() as Promise<ImportProgress>;
  }
  else {
    return {
      status: response.status,
      statusText: response.statusText,
      body: await response.text(),
    };
  }

  const body = response.json;
  try {
    await upsertRecord(accountSid, body);

    return {
      status: 'success',
      messageId: sqsRecord.messageId, 
    };
  } catch (err) {
    console.error(new ResourceImportProcessorError('Failed to process record'), err);

    const errMessage = err instanceof Error ? err.message : String(err);

    return {
      status: 'failure',
      messageId: sqsRecord.messageId, 
      reason: new Error(errMessage),
    };
  }
};

export const handler = async (event: ScheduledEvent): Promise<void> => {
  const batchItemFailuresSet: Set<string> = new Set();

  try {
    if (!internalResourcesBaseUrl) {
      console.error('Missing internal resources base url');
    }

    if (!hrmEnv) {
      console.error('Missing NODE_ENV');
    }



    return { batchItemFailures: Array.from(batchItemFailuresSet).map(messageId => ({
        itemIdentifier: messageId,
      })),
    };
  } catch (err) {
    // SSM failures and other major setup exceptions will cause a failure of all messages sending them to DLQ
    // which should be the same as the completed queue right now.
    console.error(new ResourceImportProcessorError('Failed to init processor'), err);

    return { batchItemFailures: event.Records.map(record => ({
        itemIdentifier: record.messageId,
      })) };
  }
};
