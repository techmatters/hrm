import { ImportApiResource, ImportBatch } from './importTypes';
import { db } from '../connection-pool';
import {
  updateImportProgress,
  upsertImportedResource,
  UpsertImportedResourceResult,
} from './importDataAccess';
import { AccountSID } from '@tech-matters/twilio-worker-auth';

const importService = () => {
  return {
    upsertResources: async (
      accountSid: AccountSID,
      resources: ImportApiResource[],
      batch: ImportBatch,
    ): Promise<UpsertImportedResourceResult[]> => {
      if (!resources?.length) return [];

      const results: UpsertImportedResourceResult[] = [];
      await db.tx(async t => {
        const upsert = upsertImportedResource(t);
        for (const resource of resources) {
          const result = await upsert(accountSid, resource);
          results.push(result);
        }
        const { id, updatedAt } = resources[resources.length - 1];
        await updateImportProgress(t)(accountSid, {
          ...batch,
          lastProcessedDate: updatedAt,
          lastProcessedId: id,
        });
      });
      return results;
    },
  };
};

export default importService;
