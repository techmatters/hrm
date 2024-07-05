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

import { HrmAccountId } from '@tech-matters/types';
import QueryStream from 'pg-query-stream';
import ReadableStream = NodeJS.ReadableStream;
import { db, pgp } from '@tech-matters/hrm-core/connection-pool';
import { Transform, TransformCallback } from 'stream';

const HIGH_WATER_MARK = 1000;

const SELECT_CATEGORIES_AND_TRANSCRIPTS_SQL = `
  SELECT
    c."id"
    c."rawJson"
    cm."storeTypeSpecificData"
  FROM
    "Contacts" AS c INNER JOIN "ConversationMedia" AS cm ON c."id" = cm."contactId" AND c."accountSid" = cm."accountSid"
  WHERE c."accountSid" = $<accountSid>
  AND cm."storeType" = 'S3'
  AND cm."storeTypeSpecificData"->'location' IS NOT NULL
`;

type TrainingSetContactRecord = {
  id: string;
  accountSid: HrmAccountId;
  rawJson: any;
  storeTypeSpecificData: any;
};

export type TrainingSetContact = {
  contactId: string;
  accountSid: HrmAccountId;
  categories: Record<string, string[]>;
  bucket: string;
  key: string;
};

export const streamTrainingSetContactRecords = async (
  accountSid: HrmAccountId,
): Promise<ReadableStream> => {
  const qs = new QueryStream(
    pgp.as.format(SELECT_CATEGORIES_AND_TRANSCRIPTS_SQL, { accountSid }),
    [],
    { highWaterMark: HIGH_WATER_MARK },
  );
  // Expose the readable stream to the caller as a promise for further pipelining
  return new Promise(resolve => {
    db.stream(qs, resultStream => {
      resolve(resultStream);
    });
  });
};

export const streamTrainingSetContacts = async (
  accountSid: HrmAccountId,
): Promise<ReadableStream> => {
  const recordStream = await streamTrainingSetContactRecords(accountSid);
  return recordStream.pipe(
    new Transform({
      objectMode: true,
      highWaterMark: HIGH_WATER_MARK,
      transform(record: any, _: BufferEncoding, callback: TransformCallback) {
        const trainingSetContactRecord = record as TrainingSetContactRecord;
        this.push({
          contactId: trainingSetContactRecord.id,
          accountSid: trainingSetContactRecord.accountSid,
          categories: trainingSetContactRecord.rawJson.categories,
          bucket: trainingSetContactRecord.storeTypeSpecificData.location.bucket,
          key: trainingSetContactRecord.storeTypeSpecificData.location.key,
        });
        callback();
      },
    }),
  );
};
