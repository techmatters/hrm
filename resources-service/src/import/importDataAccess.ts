import { ImportApiResource, ImportProgress } from './importTypes';
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
  try {
    return await txIfNotInOne(task, async tx => {
      await tx.one(generateUpsertSqlFromImportResource(accountSid, resource));
      return { id: resource.id, success: true };
    });
  } catch (error) {
    return { id: resource.id, success: false, error: error as Error };
  }
};

export const updateImportProgress = (task?: ITask<{}>) => async (
  accountSid: AccountSID,
  progress: ImportProgress,
): Promise<void> => {
  await txIfNotInOne(task, async tx => {
    await tx.none(generateUpdateImportProgressSql(accountSid, progress));
  });
};
