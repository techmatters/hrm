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

import { selectContactsWithRelations } from '../../contact/sql/contact-get-sql';

export const ADD_FAILED_ATTEMPT_PAYLOAD = `
  INSERT INTO "ContactJobsFailures" ("contactJobId", "attemptNumber", "payload", "createdAt")
  VALUES ($<contactJobId>, $<attemptNumber>, $<attemptPayload:json>::JSONB, current_timestamp)
  RETURNING *
`;

export const COMPLETE_JOB_SQL = `
  UPDATE "ContactJobs" SET
      "completed" = CURRENT_TIMESTAMP,
      "completionPayload" = $<completionPayload:json>::JSONB
  WHERE "id" = $<id>
  RETURNING *
`;

export const PENDING_CLEANUP_JOBS = `
  SELECT * FROM "ContactJobs" WHERE
    "cleanupStatus" = 'pending'
    AND "accountSid" = $<accountSid>
    AND "completed" IS NOT NULL
    AND "completed" < (current_timestamp - interval '$<cleanupRetentionDays> day')`;

export const PENDING_CLEANUP_JOB_ACCOUNT_SIDS = `
  SELECT DISTINCT "accountSid" FROM "ContactJobs" WHERE
    "cleanupStatus" = 'pending'
    AND "completed" IS NOT NULL
    AND "completed" < (current_timestamp - interval '$<maxCleanupRetentionDays> day')`;

export const PULL_DUE_JOBS_SQL = `
  WITH due AS (
    UPDATE "ContactJobs" SET "lastAttempt" = CURRENT_TIMESTAMP, "numberOfAttempts" = "numberOfAttempts" + 1
    WHERE "completed" IS NULL AND "numberOfAttempts" < $<jobMaxAttempts> AND ("lastAttempt" IS NULL OR "lastAttempt" <= $<lastAttemptedBefore>::TIMESTAMP WITH TIME ZONE) RETURNING *
  )
  SELECT due.*, to_jsonb(contacts.*) AS "resource" FROM due LEFT JOIN LATERAL (
  ${selectContactsWithRelations(
    'Contacts',
  )} WHERE c."accountSid" = due."accountSid" AND c."id" = due."contactId") AS contacts ON true
`;

export const selectSingleContactJobByIdSql = (table: string) =>
  `SELECT * FROM "${table}" WHERE id = $(jobId)`;
