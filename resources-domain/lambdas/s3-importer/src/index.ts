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
import { getS3Object } from '@tech-matters/s3-client';

export const handler = async (event: S3Event): Promise<void> => {
  console.debug('Triggered by event:', JSON.stringify(event));
  event.Records.map(async ({ s3: { object, bucket } }) => {
    const csv = await getS3Object({ bucket: bucket.name, key: object.key });
    for await (const csvLine of parse(csv, { fromLine: 2 })) {
    }
  });
};
