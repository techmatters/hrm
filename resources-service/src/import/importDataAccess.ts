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

import { ImportApiResource, ImportProgress } from '@tech-matters/hrm-types';
import { generateUpdateImportProgressSql, generateUpsertSqlFromImportResource } from './sql';
import { AccountSID } from '@tech-matters/twilio-worker-auth';
import { ITask } from 'pg-promise';
import { db } from '../connection-pool';

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

export const upsertImportedResource = (task?: ITask<{}>) => async (
  accountSid: AccountSID,
  resource: ImportApiResource,
): Promise<UpsertImportedResourceResult> => {
  return txIfNotInOne(task, async tx => {
    await tx.none(generateUpsertSqlFromImportResource(accountSid, resource));
    return { id: resource.id, success: true };
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
