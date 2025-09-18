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

import type { S3Event } from 'aws-lambda';
import { parse } from 'csv-parse';
import { deleteS3Object, getS3Object, putS3Object } from '@tech-matters/s3-client';
import { expandCsvLine, transformUschResourceToApiResource } from './uschMappings';
import {
  waitForEmptyQueue,
  publishToImportConsumer,
  ResourceMessage,
} from '@tech-matters/resources-import-producer';
import getConfig from './config';
import { newSqsClient } from '@tech-matters/sqs-client';

export const COMPLETED_KEY = 'completed-s3-imports';

export const handler = async (event: S3Event): Promise<void> => {
  console.debug('Triggered by event:', JSON.stringify(event));
  const { largeMessagesS3Bucket, importResourcesSqsQueueUrl, accountSid } =
    await getConfig();

  const sqs = newSqsClient({
    largeMessageS3BaseLocation: {
      bucket: largeMessagesS3Bucket,
      key: 'sqsLargeMessageContent',
    },
  });
  const configuredPublish = publishToImportConsumer(sqs, importResourcesSqsQueueUrl);

  console.debug('waiting for empty queue');
  await waitForEmptyQueue(importResourcesSqsQueueUrl);

  for (const {
    s3: { object, bucket },
  } of event.Records) {
    console.debug('getting csv from bucket');
    const csv = await getS3Object({ bucket: bucket.name, key: object.key });
    const key = decodeURIComponent(object.key);
    console.debug('got csv from bucket, key: ', key);
    for await (const csvLine of parse(csv, {
      columns: headings => headings,
    })) {
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${csvLine.ResourceID}): Transforming resource`,
      );
      const aseloResource = transformUschResourceToApiResource(
        accountSid,
        expandCsvLine(csvLine),
      );
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${aseloResource.id}): Publishing resource to import pending queue`,
      );
      const resourceMessage: ResourceMessage = {
        batch: { fromSequence: '', toSequence: '', remaining: 0 },
        accountSid,
        importedResources: [aseloResource],
      };
      await configuredPublish(resourceMessage);
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${aseloResource.id}): Published resource to import pending queue`,
      );
    }
    const keyParts = key.split('/');
    const restOfCompletedKey = (keyParts.length > 1 ? keyParts.slice(1) : keyParts).join(
      '/',
    );
    await putS3Object({
      bucket: bucket.name,
      key: `${COMPLETED_KEY}/${restOfCompletedKey}`,
      body: csv,
      contentType: 'text/csv; charset=utf-8',
    });
    await deleteS3Object({
      bucket: bucket.name,
      key,
    });
  }
};
