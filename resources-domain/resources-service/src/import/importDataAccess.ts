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

import type { AccountSID } from '@tech-matters/types';

import type {
  FlatResource,
  ImportBatch,
  ImportProgress,
} from '@tech-matters/resources-types';
import {
  generateInsertImportErrorSql,
  generateUpdateImportBatchRecordSql,
  generateUpdateImportProgressSql,
  generateUpsertSqlFromImportResource,
  SELECT_IMPORT_PROGRESS_SQL,
} from './sql';
import { ITask } from 'pg-promise';
import { db } from '../connection-pool';

const getBatchId = (batch: ImportBatch): string =>
  `${batch.fromSequence}-${batch.toSequence}/${batch.remaining}`;

const txIfNotInOne = async <T>(
  task: ITask<{}> | undefined,
  work: (y: ITask<{}>) => Promise<T>,
): Promise<T> => {
  if (task) {
    return task.txIf(work);
  }
  return db.tx(work);
};

export type UpsertImportedResourceResult = {
  id: string;
  success: boolean;
  error?: Error;
};

export const upsertImportedResource =
  (task?: ITask<{}>) =>
  async (
    accountSid: AccountSID,
    resource: FlatResource,
  ): Promise<UpsertImportedResourceResult> => {
    try {
      return await txIfNotInOne(task, async tx => {
        await tx.none(generateUpsertSqlFromImportResource(accountSid, resource));
        return { id: resource.id, success: true };
      });
    } catch (error) {
      return { id: resource.id, success: false, error: error as Error };
    }
  };

export const updateImportProgress =
  (task?: ITask<{}>) =>
  async (
    accountSid: AccountSID,
    progress: ImportProgress,
    processed: number,
  ): Promise<void> => {
    await txIfNotInOne(task, async tx => {
      await tx.none(generateUpdateImportProgressSql(accountSid, progress));
      await tx.none(
        generateUpdateImportBatchRecordSql(
          accountSid,
          getBatchId(progress),
          progress,
          processed,
          0,
        ),
      );
    });
  };

export const insertImportError =
  (task?: ITask<{}>) =>
  async (
    accountSid: AccountSID,
    resourceId: string,
    batch: ImportBatch,
    error: any,
    rejectedBatch: FlatResource[],
  ) => {
    await txIfNotInOne(task, async tx => {
      const batchId = getBatchId(batch);
      await tx.none(
        generateInsertImportErrorSql(
          accountSid,
          resourceId,
          batchId,
          error,
          rejectedBatch,
        ),
      );
      await tx.none(
        generateUpdateImportBatchRecordSql(
          accountSid,
          batchId,
          batch,
          0,
          rejectedBatch.length,
        ),
      );
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
