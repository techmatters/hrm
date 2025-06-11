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

import format from 'date-fns/format';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { putS3Object } from '@tech-matters/s3-client';
import {
  EntityNotification,
  getNormalisedNotificationPayload,
} from './entityNotification';
import { getSsmParameter } from '@tech-matters/ssm-cache';

const processRecord = async (record: SQSRecord) => {
  const notification: EntityNotification = JSON.parse(record.body);
  console.debug('Processing message:', record.messageId);
  const bucket = await getSsmParameter(
    `/${process.env.NODE_ENV!}/s3/${notification.accountSid}/docs_bucket_name`,
  );
  const { payload, timestamp, entityType } =
    getNormalisedNotificationPayload(notification);
  if (payload === null) {
    throw new Error(
      `No expected payload on notification: ${JSON.stringify(notification)}`,
    );
  }
  console.debug(
    `Recording ${entityType} update notification, accountSid: ${notification.accountSid}, ${entityType} ID: ${payload.id}, operation: ${notification.operation}`,
  );

  const key = `${process.env.JSON_EXPORT_DIRECTORY || 'hrm-data'}/${format(
    timestamp,
    'yyyy/MM/dd',
  )}/${entityType}s/${payload.id}.json`;

  await putS3Object({
    key,
    bucket,
    body: JSON.stringify(payload),
  });

  console.info(
    `Recorded contact update notification, accountSid: ${payload.accountSid}, ${entityType} ID: ${payload.id}, operation: ${notification.operation}`,
  );
};

export const handler = async (event: SQSEvent): Promise<any> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };

  try {
    const promises = event.Records.map(async sqsRecord => processRecord(sqsRecord));

    await Promise.all(promises);

    return response;
  } catch (err) {
    console.error('Failed to process sqs messages', event, err);

    // We fail all messages here and rely on SQS retry/DLQ because we hit
    // a fatal error before we could process any of the messages. Once we
    // start using this lambda, we'll need to be sure the internal retry
    // logic is robust enough to handle transient errors.
    response.batchItemFailures = event.Records.map(record => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};
