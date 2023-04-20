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
        const { id, updatedAt } = resources.sort((a, b) =>
          a.updatedAt > b.updatedAt ? 1 : a.updatedAt < b.updatedAt ? -1 : a.id > b.id ? 1 : -1,
        )[resources.length - 1];
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
