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
export * from './indexConfiguration';
export * from './searchConfiguration';
import type { MappingProperty } from '@elastic/elasticsearch/lib/api/types';

export type MappingToDocument<T extends NonNullable<Record<string, MappingProperty>>> = {
  [k in keyof T]: k extends string
    ? T[k]['type'] extends 'keyword'
      ? string
      : T[k]['type'] extends 'text'
      ? string
      : T[k]['type'] extends 'integer'
      ? number
      : T[k]['type'] extends 'boolean'
      ? boolean
      : T[k]['type'] extends 'date'
      ? string
      : T[k]['type'] extends 'join'
      ? { name: string; parent?: string }
      : T[k]['type'] extends 'nested'
      ? T[k] extends {
          properties: Record<string, MappingProperty>;
        }
        ? MappingToDocument<T[k]['properties']>[]
        : never
      : never // forbid non-used types to force proper implementation
    : never;
};

export type CreateIndexConvertedDocument = {
  high_boost_global: string;
  low_boost_global: string;
  [key: string]: number | string | string[];
};
