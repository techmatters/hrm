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

import { FlatResource, ReferrableResourceAttribute } from '@tech-matters/types';
import {
  isHighBoostGlobalField,
  isMappingField,
  mappingFields,
  ResourcesCreateIndexConvertedDocument,
} from './config';

export const convertIndexDocument = (
  resource: FlatResource,
): ResourcesCreateIndexConvertedDocument => {
  const mappedFields: { [key: string]: string | string[] | number } = {};
  const highBoostGlobal: string[] = [];
  const LowBoostGlobal: string[] = [];

  const pushToCorrectGlobalBoostField = (key: string, value: string) => {
    if (isHighBoostGlobalField(key)) {
      highBoostGlobal.push(value);
    } else {
      LowBoostGlobal.push(value);
    }
  };

  const pushToMappingField = (key: string, value: number | string | boolean) => {
    //TODO: I don't know what keywords field will actually look like should handle arrays here
    if (mappingFields![key].isArrayField) {
      if (!mappedFields[key]) {
        mappedFields[key] = [];
      }

      // TODO: not spending too much time on this, could we support multiple numbers in array mapped fields?
      const mapField = mappedFields[key] as string[];
      mapField.push(value.toString());
    } else {
      mappedFields[key] = typeof value === 'boolean' ? value.toString() : value;
    }
  };

  const parseAttribute = (
    key: string,
    { value }: ReferrableResourceAttribute<boolean | string | number>,
  ) => {
    if (isMappingField(key)) {
      return pushToMappingField(key, value);
    }
    // We don't really want booleans & numbers in the general purpose buckets
    if (typeof value === 'string') {
      pushToCorrectGlobalBoostField(key, value);
    }
  };

  const { id, name, lastUpdated, ...attributeArrays } = resource;

  Object.values(attributeArrays).forEach(attributes => {
    attributes.forEach(({ key, ...attribute }) => {
      parseAttribute(key, attribute);
    });
  });

  return {
    name,
    high_boost_global: highBoostGlobal.join(' '),
    low_boost_global: LowBoostGlobal.join(' '),
    ...mappedFields,
  };
};
