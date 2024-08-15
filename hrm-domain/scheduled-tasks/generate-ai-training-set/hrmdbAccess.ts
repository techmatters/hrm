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

const HIGH_WATER_MARK = 1000;

const SELECT_CATEGORIES_AND_TRANSCRIPTS_SQL = `
  SELECT
    c."id" AS "contactId",
    c."rawJson"->'categories' AS "categories",
    cm."storeTypeSpecificData",
    cm."storeTypeSpecificData"->'location'->>'bucket' AS "transcriptBucket",
    cm."storeTypeSpecificData"->'location'->>'key' AS "transcriptKey"
  FROM
    "Contacts" AS c INNER JOIN "ConversationMedias" AS cm ON c."id" = cm."contactId" AND c."accountSid" = cm."accountSid"
  WHERE 
  c."accountSid" = $<accountSid> AND 
  (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(c."rawJson"->'categories', '{}'::jsonb))) > 0 AND 
  cm."storeType" = 'S3' AND 
  cm."storeTypeSpecificData"->>'type' = 'transcript' AND
  cm."storeTypeSpecificData"->>'location' IS NOT NULL
`;

export type TrainingSetContact = {
  contactId: string;
  accountSid: HrmAccountId;
  categories: Record<string, string[]>;
  transcriptKey: string;
  transcriptBucket: string;
};

export const streamTrainingSetContacts = async (
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
