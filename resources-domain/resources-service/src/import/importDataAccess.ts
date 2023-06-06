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

import { AccountSID, FlatResource, ImportFlatResource, ImportProgress } from '@tech-matters/types';
import {
  generateUpdateImportProgressSql,
  generateUpsertSqlFromImportResource,
  SELECT_IMPORT_PROGRESS_SQL,
} from './sql';
import { ITask } from 'pg-promise';
import { db } from '../connection-pool';
import { SELECT_RESOURCE_IN_IDS } from '../resource/sql/resourceGetSql';

const txIfNotInOne = async <T>(
  task: ITask<{}> | undefined,
  work: (y: ITask<{}>) => Promise<T>,
): Promise<T> => {
  if (task) {
    return task.txIf(work);
  }
  return db.tx(work);
};

export type UpsertImportedResourceResult =
  | {
      success: true;
      resource: FlatResource;
    }
  | {
      id: string;
      success: false;
      error: Error;
    };

export const upsertImportedResource = (task?: ITask<{}>) => async (
  accountSid: AccountSID,
  resource: ImportFlatResource,
): Promise<UpsertImportedResourceResult> => {
  return txIfNotInOne(task, async tx => {
    await tx.none(generateUpsertSqlFromImportResource(accountSid, resource));
    const savedResource: FlatResource | null = await tx.oneOrNone(SELECT_RESOURCE_IN_IDS, {
      accountSid,
      resourceIds: [resource.id],
    });
    if (savedResource) {
      return { resource: savedResource, success: true };
    }
    return {
      id: resource.id,
      success: false,
      error: new Error('Upserted resource not found in DB after saving'),
    };
  });
};

export const updateImportProgress = (task?: ITask<{}>) => async (
  accountSid: AccountSID,
  progress: ImportProgress,
): Promise<void> => {
  await txIfNotInOne(task, async tx => {
    await tx.none(generateUpdateImportProgressSql(accountSid, progress));
  });
};

/**
 * Reads the current import progress from the database for the specified account
 */
export const getImportState = async (
  accountSid: AccountSID,
): Promise<ImportProgress | undefined> => {
  const result = await db.oneOrNone(SELECT_IMPORT_PROGRESS_SQL, { accountSid });
  return result?.importState;
};
