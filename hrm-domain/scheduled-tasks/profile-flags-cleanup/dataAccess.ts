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

import { TResult, newErr, newOk } from '@tech-matters/types';
import { systemUser } from '@tech-matters/twilio-worker-auth';
import { connectToPostgres } from '@tech-matters/database-connect';
import adminConnectionConfig from '@tech-matters/hrm-core/config/db';

export const db = connectToPostgres({
  ...adminConnectionConfig,
  applicationName: 'hrm-service',
});

export const cleanupProfileFlags = async (): Promise<
  TResult<'InternalServerError', { count: number }>
> => {
  try {
    const currentTimestamp = new Date().toISOString();
    const updatedBy = systemUser;
    const count = await db.task(async t =>
      t.one(
        `
          WITH "deleted" AS (DELETE FROM "ProfilesToProfileFlags" WHERE "validUntil" < $<currentTimestamp>::timestamp RETURNING *),

          -- trigger an update on profiles to keep track of who associated
          "updatedProfiles" AS (
            UPDATE "Profiles" "profiles"
            SET "updatedBy" = $<updatedBy>, "updatedAt" = $<currentTimestamp>::timestamp
            FROM deleted
            WHERE "profiles"."accountSid" = "deleted"."accountSid" AND "profiles"."id" = "deleted"."profileId"
          )

          SELECT COUNT(*) FROM deleted;
        `,
        { currentTimestamp, updatedBy },
      ),
    );

    return newOk({ data: count });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};
