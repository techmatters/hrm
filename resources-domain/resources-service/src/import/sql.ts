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

import { pgp } from '../connection-pool';
import type { AccountSID, HrmAccountId } from '@tech-matters/types';
import type {
  ImportProgress,
  FlatResource,
  ImportBatch,
} from '@tech-matters/resources-types';

const DELETE_RESOURCE_ATTRIBUTES_SQL = `DELETE FROM resources."ResourceStringAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceNumberAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceBooleanAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceDateTimeAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>`;

export const generateUpsertSqlFromImportResource = (
  accountSid: HrmAccountId,
  { stringAttributes, referenceStringAttributes, ...resourceRecord }: FlatResource,
): string => {
  const sqlBatch: string[] = [];
  sqlBatch.push(`${pgp.helpers.insert(
    {
      ...resourceRecord,
      accountSid,
      created: resourceRecord.lastUpdated,
      lastUpdated: resourceRecord.lastUpdated,
      deletedAt: resourceRecord.deletedAt || null,
    },
    ['id', 'name', 'accountSid', 'created', 'lastUpdated'],
    { schema: 'resources', table: 'Resources' },
  )} 
  ON CONFLICT ("id", "accountSid") 
  DO UPDATE SET "name" = EXCLUDED."name", "lastUpdated" = EXCLUDED."lastUpdated"`);

  const nonTranslatableTables = [
    { property: 'numberAttributes', table: 'ResourceNumberAttributes' },
    { property: 'booleanAttributes', table: 'ResourceBooleanAttributes' },
    { property: 'dateTimeAttributes', table: 'ResourceDateTimeAttributes' },
  ] as const;

  sqlBatch.push(
    pgp.as.format(DELETE_RESOURCE_ATTRIBUTES_SQL, {
      resourceId: resourceRecord.id,
      accountSid,
    }),
  );
  sqlBatch.push(
    ...stringAttributes.map(attribute => {
      const { key, value, info, language } = attribute;
      return pgp.helpers.insert(
        {
          accountSid,
          resourceId: resourceRecord.id,
          key,
          value,
          info,
          language: language ?? '',
        },
        ['accountSid', 'resourceId', 'key', 'value', 'language', 'info'],
        { schema: 'resources', table: 'ResourceStringAttributes' },
      );
    }),
  );
  sqlBatch.push(
    ...nonTranslatableTables.flatMap(({ property, table }) =>
      resourceRecord[property].map(attribute => {
        const { key, value, info } = attribute;
        return pgp.helpers.insert(
          {
            accountSid,
            resourceId: resourceRecord.id,
            key,
            value,
            info,
          },
          ['accountSid', 'resourceId', 'key', 'value', 'info'],
          { schema: 'resources', table },
        );
      }),
    ),
  );
  sqlBatch.push(
    pgp.as.format(
      `DELETE FROM resources."ResourceReferenceStringAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>`,
      { resourceId: resourceRecord.id, accountSid },
    ),
  );

  sqlBatch.push(
    ...referenceStringAttributes.map(attribute => {
      return pgp.as.format(
        `INSERT INTO resources."ResourceReferenceStringAttributes" 
    ("accountSid", "resourceId", "key", "list", "referenceId") 
    SELECT $<accountSid>, $<resourceId>, $<key>, $<list>, "id" 
      FROM resources."ResourceReferenceStringAttributeValues" 
      WHERE "accountSid" = $<accountSid> AND "list" = $<list> AND "value" = $<value>
  ON CONFLICT ("accountSid", "resourceId", "key", "list", "referenceId") 
  DO NOTHING`,
        { ...attribute, accountSid, resourceId: resourceRecord.id },
      );
    }),
  );
  return sqlBatch.join(';\n');
};

export const generateUpdateImportProgressSql = (
  accountSid: AccountSID,
  progress: ImportProgress,
) =>
  `
    ${pgp.helpers.insert(
      {
        accountSid,
        importState: progress,
      },
      ['accountSid', 'importState'],
      { schema: 'resources', table: 'Accounts' },
    )}
    ON CONFLICT ON CONSTRAINT "Accounts_pkey" 
    DO UPDATE SET "importState" = EXCLUDED."importState"
  `;

export const generateUpdateImportBatchRecordSql = (
  accountSid: AccountSID,
  batchId: string,
  batchContext: ImportBatch,
  successCount: number,
  failureCount: number,
) =>
  `
    ${pgp.helpers.insert(
      {
        accountSid,
        batchId,
        successCount,
        failureCount,
        batchContext,
      },
      ['accountSid', 'batchId', 'successCount', 'failureCount', 'batchContext'],
      { schema: 'resources', table: 'ImportBatches' },
    )}
    ON CONFLICT ON CONSTRAINT "ImportBatches_pkey" 
    DO UPDATE SET "failureCount" = EXCLUDED."failureCount" + "ImportBatches"."failureCount", "successCount" = EXCLUDED."successCount" + "ImportBatches"."successCount"
  `;

export const generateInsertImportErrorSql = (
  accountSid: AccountSID,
  resourceId: string,
  batchId: string,
  error: any,
  rejectedBatch: FlatResource[],
) =>
  pgp.helpers.insert(
    {
      accountSid,
      batchId,
      resourceId,
      error,
      rejectedBatch,
    },
    ['accountSid', 'batchId', 'resourceId', 'error', 'rejectedBatch:json'],
    { schema: 'resources', table: 'ImportErrors' },
  );

export const SELECT_IMPORT_PROGRESS_SQL = `
  SELECT "importState" FROM resources."Accounts" WHERE "accountSid" = $<accountSid>
`;
