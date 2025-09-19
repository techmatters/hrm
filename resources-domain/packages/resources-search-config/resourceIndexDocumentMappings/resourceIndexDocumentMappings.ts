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
  PropertyName,
  MappingKeywordProperty,
  MappingProperty,
  MappingTextProperty,
} from '@elastic/elasticsearch/lib/api/types';
import type { ReferrableResourceAttribute } from '@tech-matters/resources-types';

export type MappingFieldType =
  | 'integer'
  | 'keyword'
  | 'text'
  | 'boolean'
  | 'date'
  | 'completion';

export type MappingField = {
  type: MappingFieldType;

  // hasLanguageFields is used to indicate that this field has language fields that should be indexed individually
  hasLanguageFields?: boolean;

  // isArrayField is used to indicate that this field is an array field and should be indexed as such
  isArrayField?: boolean;

  // The attributeKeyPattern is used to match attribute keys to this field when the field name does not match the attribute key
  attributeKeyPattern?: RegExp;

  // The copyTo field is used to copy the value of this field to other fields
  copyTo?: string[];

  // The indexValueGenerator is used to generate the value that should be indexed for this field
  indexValueGenerator?: (
    attribute: ReferrableResourceAttribute<any>,
  ) => boolean | string | number;
};

export type ResourceLanguageField = Record<PropertyName, MappingProperty>;

export type ResourceIndexDocumentMappings = {
  highBoostGlobalFields: string[];
  mappingFields: {
    [key: string]: MappingField;
  };
  languageFields: ResourceLanguageField;
};

export type FieldAndMapping = {
  field: string;
  mapping: MappingField;
};

const stringFieldTypes = ['text', 'keyword'];

/**
 * Returns the mapping field for the given field name.
 * First checks if the field name is a key in the mappingFields object, if it is, it returns the field name and mapping on the matching key
 * If the field name is not a key in the mappingFields object, it checks if the field name matches the attributeKeyPattern of any of the mappingFields
 * This is for cases like 'province' where qwe have several attributes that have a province and we want to map them back to the same field for indexing
 * If the field name is not a key in the mappingFields object and does not match the attributeKeyPattern of any of the mappingFields, it returns undefined
 * @param mappingFields
 * @param fieldName
 */
export const getMappingFields = (
  { mappingFields }: Pick<ResourceIndexDocumentMappings, 'mappingFields'>,
  fieldName: string,
): FieldAndMapping[] => {
  if (Object.keys(mappingFields).includes(fieldName)) {
    return [{ field: fieldName, mapping: mappingFields[fieldName] }];
  }

  return Object.entries(mappingFields)
    .filter(([, { attributeKeyPattern }]) => attributeKeyPattern?.test(fieldName))
    .map(([field, mapping]) => ({ field, mapping }));
};

export const isHighBoostGlobalField = (
  { highBoostGlobalFields }: Pick<ResourceIndexDocumentMappings, 'highBoostGlobalFields'>,
  fieldName: string,
) => highBoostGlobalFields.includes(fieldName);

export const isLowBoostGlobalField = (
  resourceIndexDocumentMappings: ResourceIndexDocumentMappings,
  fieldName: string,
) => {
  if (isHighBoostGlobalField(resourceIndexDocumentMappings, fieldName)) return false;

  const fieldAndMappings = getMappingFields(resourceIndexDocumentMappings, fieldName);
  return fieldAndMappings === undefined || fieldAndMappings.length === 0;
};

export const isStringField = (fieldType: string): fieldType is 'keyword' | 'text' =>
  stringFieldTypes.includes(fieldType);

export const getMappingFieldNamesByType =
  (mappings: ResourceIndexDocumentMappings) => (targetType: MappingFieldType) =>
    Object.entries(mappings.mappingFields)
      .filter(([, { type }]) => type === targetType)
      .map(([fieldName]) => fieldName);

const convertStringMappingFieldToProperty =
  (mappings: ResourceIndexDocumentMappings) =>
  (key: string, property: MappingProperty, propConfig: MappingField): MappingProperty => {
    const stringProperty = property as MappingTextProperty | MappingKeywordProperty;

    stringProperty.copy_to = isHighBoostGlobalField(mappings, key)
      ? ['high_boost_global']
      : ['low_boost_global'];

    if (propConfig.hasLanguageFields) {
      stringProperty.fields = mappings.languageFields;
    }

    if (propConfig.copyTo) {
      stringProperty.copy_to = [...stringProperty.copy_to, ...propConfig.copyTo];
    }

    return stringProperty as MappingProperty;
  };

export const convertMappingFieldsToProperties = (
  mappings: ResourceIndexDocumentMappings,
): Record<string, MappingProperty> => {
  const properties: Record<string, MappingProperty> = {};

  Object.entries(mappings.mappingFields).forEach(([key, propConfig]) => {
    let property: MappingProperty = {};

    if (isStringField(propConfig.type)) {
      property = convertStringMappingFieldToProperty(mappings)(key, property, propConfig);
    }

    property.type = propConfig.type;
    properties[key] = property;
  });

  return properties;
};
