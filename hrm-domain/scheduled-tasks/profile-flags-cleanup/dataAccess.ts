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

import { db } from '@tech-matters/hrm-core/connection-pool';
import { TResult, newErr, newOk } from '@tech-matters/types';

export const cleanupProfileFlags = async (): Promise<
  TResult<'InternalServerError', { count: number }>
> => {
  try {
    const currentTimestamp = new Date().toISOString();
    const count = await db.task(async t =>
      t.one(
        `
        WITH deleted AS (DELETE FROM "ProfilesToProfileFlags" WHERE "validUntil" < $<currentTimestamp>::timestamp RETURNING *)
          SELECT COUNT(*) FROM deleted;
  `,
        { currentTimestamp },
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
