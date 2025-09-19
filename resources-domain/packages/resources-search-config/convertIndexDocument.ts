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

import type {
  FlatResource,
  ReferrableResourceAttribute,
} from '@tech-matters/resources-types';
import { CreateIndexConvertedDocument } from '@tech-matters/elasticsearch-client';
import {
  isHighBoostGlobalField,
  isLowBoostGlobalField,
  getMappingFields,
  FieldAndMapping,
  ResourceIndexDocumentMappings,
} from './resourceIndexDocumentMappings';

export const convertIndexDocument =
  (mappings: ResourceIndexDocumentMappings) =>
  (
    resource: FlatResource,
  ): CreateIndexConvertedDocument<{
    [key: string]: string | string[] | number | boolean;
  }> => {
    const { mappingFields } = mappings;
    const mappedFields: { [key: string]: string | string[] | number | boolean } = {};
    const highBoostGlobal: string[] = [];
    const lowBoostGlobal: string[] = [];

    const isStringOrStringArray = (value: any): value is string | string[] =>
      typeof value === 'string' ||
      (Array.isArray(value) && value.every(item => typeof item === 'string'));

    /**
     * There are 3 possible scenarios for a given key/attribute pair:
     * 1. Push the value to the high boost global fields
     *  - If the key is marked as a high boost global field;
     *
     * 2. Push the value to the low boost global fields
     *  - If the key is not marked as a high boost global field and is not a mapped field;
     *
     * 3. Do not push the value to any global fields
     *  - If the key is not a high boost global field but is a mapped field;
     *  - Or if the value is not a string or string array. It doesn't make sense to boost a number or boolean;
     */
    const pushToCorrectGlobalBoostField = (key: string, attributeValue: any) => {
      // Scenario 3: value is not a string or string array
      if (!isStringOrStringArray(attributeValue)) return;

      const value = Array.isArray(attributeValue)
        ? attributeValue.join(' ')
        : attributeValue;

      // Scenario 1: key is marked as a high boost global field
      if (isHighBoostGlobalField(mappings, key)) {
        highBoostGlobal.push(value);
        return;
      }

      // Scenario 2: key is not marked as a high boost global field and is not a mapped field
      if (isLowBoostGlobalField(mappings, key)) {
        lowBoostGlobal.push(value);
        return;
      }
    };

    const pushValueToMappedField = (
      { field, mapping }: FieldAndMapping,
      value: boolean | string | number,
    ) => {
      if (mapping.isArrayField) {
        if (!mappedFields[field]) {
          mappedFields[field] = [];
        }

        const mapField = mappedFields[field] as (typeof value)[];
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
      const fieldAndMappings = getMappingFields(mappings, key);
      if (fieldAndMappings && fieldAndMappings.length > 0) {
        for (const fieldAndMapping of fieldAndMappings) {
          const value =
            fieldAndMapping.mapping.indexValueGenerator?.(attribute) ?? attribute.value;
          pushValueToMappedField(fieldAndMapping, value);
          pushToCorrectGlobalBoostField(fieldAndMapping.field, value);
        }
      } else {
        pushToCorrectGlobalBoostField(key, attribute.value);
      }
    };

    const {
      id,
      name,
      lastUpdated,
      deletedAt,
      accountSid,
      importSequenceId,
      ...attributeArrays
    } = resource;

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
