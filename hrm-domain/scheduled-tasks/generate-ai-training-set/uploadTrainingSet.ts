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

import ReadableStream = NodeJS.ReadableStream;
import { Upload } from '@aws-sdk/lib-storage';
import { getNativeS3Client, putS3Object } from '@tech-matters/s3-client';
import { PassThrough } from 'stream';

const fileTimestamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/[T.].+/, '-');

export const uploadStreamAsSingleFile = async (
  trainingSetDocumentStream: ReadableStream,
  targetBucket: string,
  helplineCode: string,
) => {
  const upload = new Upload({
    client: getNativeS3Client(),
    params: {
      Bucket: targetBucket,
      Key: `${helplineCode}/categoryTrainingSet_${fileTimestamp(new Date())}.json`,
      Body: trainingSetDocumentStream.pipe(new PassThrough({ objectMode: false })),
    },
  });

  await upload.done();
};

export const uploadTrainingSetDocument = async (
  contactId: string,
  docJson: string,
  targetBucket: string,
  helplineCode: string,
): Promise<void> => {
  await putS3Object({
    bucket: targetBucket,
    key: `${helplineCode}/categoryTrainingSet_${fileTimestamp(
      new Date(),
    )}/contact_${contactId}.json`,
    body: docJson,
  });
};
