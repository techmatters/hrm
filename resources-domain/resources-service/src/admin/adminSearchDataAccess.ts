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

import { AccountSID, FlatResource } from '@tech-matters/types';
import { db } from '../connection-pool';
import { SELECT_RESOURCE_BY_UPDATEDAT } from './sql/adminSearchSql';

export const getResourcesByUpdatedDateForReindexing = async ({
  lastUpdatedFrom,
  lastUpdatedTo,
  accountSid,
  start = 0,
  limit = 1000,
}: {
  lastUpdatedFrom?: Date;
  lastUpdatedTo?: Date;
  accountSid?: AccountSID;
  start?: number;
  limit?: number;
}): Promise<FlatResource[]> => {
  return db.task(async tx => {
    return tx.manyOrNone(SELECT_RESOURCE_BY_UPDATEDAT, {
      lastUpdatedFrom,
      lastUpdatedTo,
      accountSid,
      start,
      limit,
    });
  });
};
