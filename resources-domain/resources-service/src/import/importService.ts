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
import {
  AccountSID,
  FlatResource,
  ImportBatch,
  ImportProgress,
  TimeSequence,
} from '@tech-matters/types';
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
              const err = new Error() as any;
              err.validationFailure = {
                reason: 'missing field',
                fields: missingFields,
              };
              err.resource = resource;
              throw err;
            }
            console.debug(`Upserting ${accountSid}/${resource.id}`);
            const result = await upsert(accountSid, resource);
            if (!result.success) {
              const dbErr = new Error('Error inserting resource into database.') as any;
              dbErr.resource = resource;
              dbErr.cause = result.error;
              throw dbErr;
            }
            results.push(result);

            try {
              await publishSearchIndexJob(resource.accountSid, resource);
            } catch (e) {
              console.error(
                `Failed to publish search index job for ${resource.accountSid}/${resource.id}`,
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
            error.resource?.id ?? 'unknown'
          } - rolling back upserts in this message.`,
          error,
        );
        await insertImportError()(
          accountSid,
          error.resource?.id,
          batch,
          serializeError(error),
          resources,
        );
        if (error.validationFailure) {
          return { ...error.validationFailure, resource: error.resource };
        }
        throw error;
      }
    },
    readImportProgress: (accountSid: AccountSID): Promise<ImportProgress | undefined> =>
      getImportState(accountSid),
  };
};

export default importService;
