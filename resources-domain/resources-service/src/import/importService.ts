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
import parseISO from 'date-fns/parseISO';
import type { AccountSID, HrmAccountId } from '@tech-matters/types';
import type {
  FlatResource,
  ImportBatch,
  ImportProgress,
  TimeSequence,
} from '@tech-matters/resources-types';
import { db } from '../connection-pool';
import {
  getImportState,
  insertImportError,
  updateImportProgress,
  upsertImportedResource,
  UpsertImportedResourceResult,
} from './importDataAccess';
import { publishSearchIndexJob } from '../resource-jobs/client-sqs';
const { serializeError } = require('serialize-error');

export type ValidationFailure = {
  reason: 'missing field';
  fields: string[];
  resource: FlatResource;
};

export const isValidationFailure = (result: any): result is ValidationFailure => {
  return result.reason === 'missing field';
};

const REQUIRED_FIELDS = ['id', 'name', 'lastUpdated'] as const;

/**
 * Unfortunately the timestamp-with-sequence identifiers are not padded to be alphabetically sortable
 * So they require a custom comparator
 */

const compareTimeSequences = (a: TimeSequence, b: TimeSequence) => {
  const [aTime, aSequence] = a.split('-').map(Number);
  const [bTime, bSequence] = b.split('-').map(Number);
  return aTime - bTime || aSequence - bSequence;
};

const importService = () => {
  return {
    upsertResources: async (
      accountSid: HrmAccountId,
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
              const err = new Error() as any;
              err.validationFailure = {
                reason: 'missing field',
                fields: missingFields,
              };
              err.resourceJson = JSON.stringify(resource);
              err.resourceId = resource.id;
              throw err;
            }
            console.debug(
              `[Imported Resource Trace ${accountSid}] Upserting ${accountSid}/${resource.id}`,
            );
            const result = await upsert(accountSid, resource);
            if (!result.success) {
              const dbErr = new Error('Error inserting resource into database.') as any;
              dbErr.resourceJson = JSON.stringify(resource);
              dbErr.resourceId = resource.id;
              dbErr.cause = result.error;
              throw dbErr;
            }
            console.debug(`Upserted ${accountSid}/${resource.id}`);
            results.push(result);

            try {
              await publishSearchIndexJob(resource.accountSid, resource);
              console.debug(
                `[Imported Resource Trace ${accountSid}] Published search index job for ${accountSid}/${resource.id}`,
              );
            } catch (e) {
              console.error(
                `[Imported Resource Trace ${accountSid}] Failed to publish search index job for ${resource.accountSid}/${resource.id}`,
              );
            }
          }
          const { id, lastUpdated, importSequenceId } = [...resources].sort((a, b) =>
            compareTimeSequences(
              a.importSequenceId || `${parseISO(a.lastUpdated).valueOf()}-0`,
              b.importSequenceId || `${parseISO(b.lastUpdated).valueOf()}-0`,
            ),
          )[resources.length - 1];
          await updateImportProgress(t)(
            accountSid,
            {
              ...batch,
              importSequenceId,
              lastProcessedDate: lastUpdated,
              lastProcessedId: id,
            },
            resources.length,
          );

          return results;
        });
      } catch (e) {
        const error = e as any;
        console.error(
          `Failed to upsert ${accountSid}/${
            error.resourceId ?? 'unknown'
          } - rolling back upserts in this message.`,
          error,
        );
        await insertImportError()(
          accountSid,
          error.resourceId,
          batch,
          serializeError(error),
          resources,
        );
        if (error.validationFailure) {
          return { ...error.validationFailure, resource: error.resourceJson };
        }
        throw error;
      }
    },
    readImportProgress: (accountSid: AccountSID): Promise<ImportProgress | undefined> =>
      getImportState(accountSid),
  };
};

export default importService;
