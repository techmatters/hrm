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
import { getDbForAdmin, pgp } from '@tech-matters/hrm-core/dbConnection';

const HIGH_WATER_MARK = 1000;

const SELECT_CATEGORIES_SUMMARY_AND_TRANSCRIPTS_SQL = `
  SELECT
    c."id" AS "contactId",
    c."rawJson"->'categories' AS "categories",
    c."rawJson"->'caseInformation'->>'callSummary' AS "summary",
    cm."storeTypeSpecificData",
    cm."storeTypeSpecificData"->'location'->>'bucket' AS "transcriptBucket",
    cm."storeTypeSpecificData"->'location'->>'key' AS "transcriptKey"
  FROM
    "Contacts" AS c INNER JOIN "ConversationMedias" AS cm ON c."id" = cm."contactId" AND c."accountSid" = cm."accountSid"
  WHERE 
  c."accountSid" = $<accountSid> AND 
  (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(c."rawJson"->'categories', '{}'::jsonb))) > 0 AND 
  COALESCE(c."rawJson"->'caseInformation'->>'callSummary', '') <> '' AND
  cm."storeType" = 'S3' AND 
  cm."storeTypeSpecificData"->>'type' = 'transcript' AND
  cm."storeTypeSpecificData"->>'location' IS NOT NULL
`;

export type TrainingSetContact = {
  contactId: string;
  accountSid: HrmAccountId;
  categories: Record<string, string[]>;
  summary: string;
  transcriptKey: string;
  transcriptBucket: string;
};

export const streamTrainingSetContacts = async (
  accountSid: HrmAccountId,
): Promise<ReadableStream> => {
  const formattedQuery = pgp.as.format(SELECT_CATEGORIES_SUMMARY_AND_TRANSCRIPTS_SQL, {
    accountSid,
  });

  const qs = new QueryStream(formattedQuery, [], { highWaterMark: HIGH_WATER_MARK });
  // Expose the readable stream to the caller as a promise for further pipelining
  const db = await Promise.resolve(getDbForAdmin());
  return new Promise((resolve, reject) => {
    db.stream(qs, resultStream => {
      resolve(resultStream);
    }).catch(error => {
      console.error('Error streaming contacts:', error);
      reject(error);
    });
  });
};
