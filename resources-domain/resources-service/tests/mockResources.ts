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

import type { HrmAccountId } from '@tech-matters/types';
import type { FlatResource } from '@tech-matters/resources-types';

export const BLANK_ATTRIBUTES: Omit<
  FlatResource,
  'id' | 'name' | 'lastUpdated' | 'deletedAt' | 'accountSid'
> = {
  stringAttributes: [],
  referenceStringAttributes: [],
  booleanAttributes: [],
  numberAttributes: [],
  dateTimeAttributes: [],
};

export const generateImportResource =
  (baselineDate: Date, accountSid: HrmAccountId) =>
  (
    resourceIdSuffix: string,
    lastUpdated: Date,
    {
      stringAttributes,
      referenceStringAttributes,
      numberAttributes,
      dateTimeAttributes,
      booleanAttributes,
    }: Partial<FlatResource> = {},
  ): FlatResource => ({
    accountSid,
    id: `RESOURCE_${resourceIdSuffix}`,
    name: `Resource ${resourceIdSuffix}`,
    lastUpdated: lastUpdated.toISOString(),
    stringAttributes: [
      {
        key: 'STRING_ATTRIBUTE',
        value: 'VALUE',
        language: 'en-US',
        info: { some: 'json' },
      },
      ...(stringAttributes ?? []),
    ],
    dateTimeAttributes: [
      {
        key: 'DATETIME_ATTRIBUTE',
        value: baselineDate.toISOString(),
        info: { some: 'json' },
      },
      ...(dateTimeAttributes ?? []),
    ],
    numberAttributes: [
      {
        key: 'NUMBER_ATTRIBUTE',
        value: 1337,
        info: { some: 'json' },
      },
      ...(numberAttributes ?? []),
    ],
    booleanAttributes: [
      {
        key: 'BOOL_ATTRIBUTE',
        value: true,
        info: { some: 'json' },
      },
      ...(booleanAttributes ?? []),
    ],
    referenceStringAttributes: [
      {
        key: 'REFERENCE_ATTRIBUTE',
        value: 'REFERENCE_VALUE_2',
        language: 'REFERENCE_LANGUAGE',
        list: 'REFERENCE_LIST_1',
        info: null,
      },
      ...(referenceStringAttributes ?? []),
    ],
  });
