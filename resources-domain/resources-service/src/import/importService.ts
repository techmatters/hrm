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

import { AccountSID, FlatResource, ImportBatch, ImportProgress } from '@tech-matters/types';
import { db } from '../connection-pool';
import {
  getImportState,
  updateImportProgress,
  upsertImportedResource,
  UpsertImportedResourceResult,
} from './importDataAccess';

export type ValidationFailure = {
  reason: 'missing field';
  fields: string[];
  resource: FlatResource;
};

export const isValidationFailure = (result: any): result is ValidationFailure => {
  return result.reason === 'missing field';
};

const REQUIRED_FIELDS = ['id', 'name', 'lastUpdated'] as const;

const importService = () => {
  return {
    upsertResources: async (
      accountSid: AccountSID,
      resources: FlatResource[],
      batch: ImportBatch,
    ): Promise<UpsertImportedResourceResult[] | ValidationFailure> => {
      if (!resources?.length) return [];
      try {
        return await db.tx(async t => {
          const results: UpsertImportedResourceResult[] = [];
          const upsert = upsertImportedResource(t);
          for (const resource of resources) {
            const missingFields = REQUIRED_FIELDS.filter(field => !resource[field]);
            if (missingFields.length) {
              // Unfortunately I can't see a way to roll back a transaction other than throwing / rejecting
              // Hence the messy throw & catch
              const err = new Error();
              (err as any).validationFailure = {
                reason: 'missing field',
                fields: missingFields,
                resource,
              };
              throw err;
            }
            console.debug(`Upserting ${accountSid}/${resource.id}`);
            const result = await upsert(accountSid, resource);
            if (!result.success) {
              throw result.error;
            }
            results.push(result);
          }
          const { id, lastUpdated } = [...resources].sort((a, b) =>
            a.lastUpdated > b.lastUpdated
              ? 1
              : a.lastUpdated < b.lastUpdated
              ? -1
              : a.id > b.id
              ? 1
              : -1,
          )[resources.length - 1];
          await updateImportProgress(t)(accountSid, {
            ...batch,
            lastProcessedDate: lastUpdated,
            lastProcessedId: id,
          });
          return results;
        });
      } catch (e) {
        const error = e as any;
        if (error.validationFailure) {
          return error.validationFailure;
        }
        throw error;
      }
    },
    readImportProgress: (accountSid: AccountSID): Promise<ImportProgress | undefined> =>
      getImportState(accountSid),
  };
};

export default importService;
