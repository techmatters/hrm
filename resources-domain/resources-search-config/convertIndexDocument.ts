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
  CreateIndexConvertedDocument,
  getMappingField,
  FieldAndMapping,
} from '@tech-matters/elasticsearch-client';
import { resourceIndexConfiguration } from './index';

export const convertIndexDocument = (resource: FlatResource): CreateIndexConvertedDocument => {
  const { mappingFields } = resourceIndexConfiguration;
  const mappedFields: { [key: string]: string | string[] | number | boolean } = {};
  const highBoostGlobal: string[] = [];
  const lowBoostGlobal: string[] = [];

  const pushToCorrectGlobalBoostField = (key: string, value: string) => {
    if (isHighBoostGlobalField(resourceIndexConfiguration, key)) {
      highBoostGlobal.push(value);
    } else {
      lowBoostGlobal.push(value);
    }
  };

  const pushValueToMappedField = (
    { field, mapping }: FieldAndMapping<ReferrableResourceAttribute<boolean | string | number>>,
    value: boolean | string | number,
  ) => {
    if (mapping.isArrayField) {
      if (!mappedFields[field]) {
        mappedFields[field] = [];
      }

      const mapField = mappedFields[field] as typeof value[];
      mapField.push(value);
    } else {
      if (mapping.hasLanguageFields) {
        console.warn(
          `Possible misconfiguration - mapping field '${field}' has the hasLanguageFields flag set but not the isArrayField: a multi-language field should normally be an array, otherwise the languages for different languages will be overwrite each other.`,
        );
      }
      mappedFields[field] = value;
    }
  };

  const parseAttribute = (
    key: string,
    attribute: ReferrableResourceAttribute<boolean | string | number>,
  ) => {
    const fieldAndMapping = getMappingField(resourceIndexConfiguration, key);
    if (fieldAndMapping) {
      return pushValueToMappedField(
        fieldAndMapping,
        fieldAndMapping.mapping.indexValueGenerator?.(attribute) ?? attribute.value,
      );
    }
    // We don't really want booleans & numbers in the general purpose buckets
    if (typeof attribute.value === 'string') {
      pushToCorrectGlobalBoostField(key, attribute.value);
    }
  };

  const { id, name, lastUpdated, accountSid, ...attributeArrays } = resource;

  Object.values(attributeArrays).forEach(attributes => {
    attributes.forEach(({ key, ...attribute }) => {
      parseAttribute(key, attribute);
    });
  });
  pushValueToMappedField({ field: 'id', mapping: mappingFields.id }, id);
  pushValueToMappedField({ field: 'name', mapping: mappingFields.name }, name);

  return {
    id,
    name,
    high_boost_global: highBoostGlobal.join(' '),
    low_boost_global: lowBoostGlobal.join(' '),
    ...mappedFields,
  };
};
