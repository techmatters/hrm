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
import { AccountSID, ImportProgress, FlatResource } from '@tech-matters/types';

export const DELETE_RESOURCE_ATTRIBUTES_SQL = `DELETE FROM resources."ResourceStringAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceNumberAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceBooleanAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceDateTimeAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>`;

export const generateUpsertSqlFromImportResource = (
  accountSid: string,
  { stringAttributes, referenceStringAttributes, ...resourceRecord }: FlatResource,
): { sql: string; values: any } => {
  const sqlBatch: string[] = [];
  const values = {
    accountSid,
    resourceId: resourceRecord.id.toString(),
    referenceStringAttributes: referenceStringAttributes.map((attribute, index) => {
      const { language, ...queryValues } = attribute;
      return [`attribute_${index}`, queryValues];
    }),
  };

  sqlBatch.push(`${pgp.helpers.insert(
    {
      ...resourceRecord,
      accountSid,
      created: resourceRecord.lastUpdated,
      lastUpdated: resourceRecord.lastUpdated,
    },
    ['id', 'name', 'accountSid', 'created', 'lastUpdated'],
    { schema: 'resources', table: 'Resources' },
  )} 
  ON CONFLICT ON CONSTRAINT "Resources_pkey" 
  DO UPDATE SET "name" = EXCLUDED."name", "lastUpdated" = EXCLUDED."lastUpdated"`);

  const nonTranslatableTables = [
    { property: 'numberAttributes', table: 'ResourceNumberAttributes' },
    { property: 'booleanAttributes', table: 'ResourceBooleanAttributes' },
    { property: 'dateTimeAttributes', table: 'ResourceDateTimeAttributes' },
  ] as const;

  sqlBatch.push(
    `DELETE FROM resources."ResourceStringAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceNumberAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceBooleanAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>;
    DELETE FROM resources."ResourceDateTimeAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>`,
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
    `DELETE FROM resources."ResourceReferenceStringAttributes" WHERE "resourceId" = $<resourceId> AND "accountSid" = $<accountSid>`,
  );

  sqlBatch.push(
    ...referenceStringAttributes.map((attribute, index) => {
      const attributeValuesKey = `referenceStringAttributes.attribute_${index}`;
      return `INSERT INTO resources."ResourceReferenceStringAttributes" 
    ("accountSid", "resourceId", "key", "list", "referenceId") 
    SELECT $<accountSid>, $<${attributeValuesKey}.sourceId>, $<${attributeValuesKey}.key>, $<${attributeValuesKey}.list>, "id" 
      FROM resources."ResourceReferenceStringAttributeValues" 
      WHERE "accountSid" = $<accountSid> AND "list" = $<${attributeValuesKey}.list> AND "value" = $<${attributeValuesKey}.value>`;
    }),
  );
  return { sql: sqlBatch.join(';\n'), values };
};

export const generateUpdateImportProgressSql = (accountSid: AccountSID, progress: ImportProgress) =>
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

export const SELECT_IMPORT_PROGRESS_SQL = `
  SELECT "importState" FROM resources."Accounts" WHERE "accountSid" = $<accountSid>
`;
