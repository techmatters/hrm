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
import { ImportProgress, ImportApiResource } from '@tech-matters/types';
import { AccountSID } from '@tech-matters/twilio-worker-auth';

export const generateUpsertSqlFromImportResource = (
  accountSid: string,
  { attributes, ...resourceRecord }: ImportApiResource,
): string => {
  const sqlBatch: string[] = [];

  sqlBatch.push(`${pgp.helpers.insert(
    { ...resourceRecord, accountSid },
    ['id', 'name', 'accountSid'],
    { schema: 'resources', table: 'Resources' },
  )} 
  ON CONFLICT ON CONSTRAINT "Resources_pkey" 
  DO UPDATE SET "name" = EXCLUDED."name"`);
  const nonTranslatableTables = [
    'ResourceNumberAttributes',
    'ResourceBooleanAttributes',
    'ResourceDateTimeAttributes',
  ] as const;
  sqlBatch.push(
    pgp.as.format(
      `DELETE FROM resources."ResourceStringAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceNumberAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceBooleanAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceDateTimeAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>`,
      { resourceId: resourceRecord.id.toString(), accountSid },
    ),
  );
  sqlBatch.push(
    ...attributes.ResourceStringAttributes.map(attribute => {
      const { key, value, info, language } = attribute;
      return pgp.as.format(
        `${pgp.helpers.insert(
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
        )}`,
      );
    }),
  );
  sqlBatch.push(
    ...nonTranslatableTables.flatMap(table =>
      attributes[table].map(attribute => {
        const { key, value, info } = attribute;
        return pgp.as.format(
          `${pgp.helpers.insert(
            {
              accountSid,
              resourceId: resourceRecord.id,
              key,
              value,
              info,
            },
            ['accountSid', 'resourceId', 'key', 'value', 'info'],
            { schema: 'resources', table },
          )}`,
        );
      }),
    ),
  );
  sqlBatch.push(
    pgp.as.format(
      `DELETE FROM resources."ResourceReferenceStringAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>`,
      { resourceId: resourceRecord.id.toString(), accountSid },
    ),
  );

  sqlBatch.push(
    ...attributes.ResourceReferenceStringAttributes.map(attribute => {
      const { language, ...queryValues } = attribute;
      return pgp.as.format(
        `INSERT INTO resources."ResourceReferenceStringAttributes" 
    ("accountSid", "resourceId", "key", "list", "referenceId") 
    SELECT $<accountSid>, $<resourceId>, $<key>, $<list>, "id" 
      FROM resources."ResourceReferenceStringAttributeValues" 
      WHERE "accountSid" = $<accountSid> AND "list" = $<list> AND "value" = $<value>`,
        { ...queryValues, accountSid, resourceId: resourceRecord.id },
      );
    }),
  );
  return sqlBatch.join(';\n');
};

export const generateUpdateImportProgressSql = (accountSid: AccountSID, progress: ImportProgress) =>
  pgp.as.format(`
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
  `);
