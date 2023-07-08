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

// eslint-disable-next-line prettier/prettier
import type {
  PropertyName,
  MappingKeywordProperty,
  MappingProperty,
  MappingTextProperty } from '@elastic/elasticsearch/lib/api/types';
import { ReferrableResourceAttribute } from '@tech-matters/types/dist/Resources';

export type MappingFieldType = 'integer' | 'keyword' | 'text' | 'boolean' | 'date' | 'completion';

export type MappingField = {
  type: MappingFieldType

  // hasLanguageFields is used to indicate that this field has language fields that should be indexed individually
  hasLanguageFields?: boolean;

  // isArrayField is used to indicate that this field is an array field and should be indexed as such
  isArrayField?: boolean;

  // The attributeKeyPattern is used to match attribute keys to this field when the field name does not match the attribute key
  attributeKeyPattern?: RegExp;

  // The copyTo field is used to copy the value of this field to other fields
  copyTo?: string[];

  // The indexValueGenerator is used to generate the value that should be indexed for this field
  indexValueGenerator?: (attribute: ReferrableResourceAttribute<any>) => boolean | string | number;
};

export type ResourceLanguageField = Record<PropertyName, MappingProperty>


export type ResourceIndexDocumentMappings = {
  highBoostGlobalFields: string[];
  mappingFields: {
    [key: string]: MappingField;
  };
  languageFields: ResourceLanguageField
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
export const getMappingField = ({ mappingFields }: Pick<ResourceIndexDocumentMappings, 'mappingFields'>, fieldName: string): FieldAndMapping | undefined => {
  if (Object.keys(mappingFields).includes(fieldName)) {
    return { field: fieldName, mapping:mappingFields[fieldName] };
  }

  const [field, mapping] = Object.entries(mappingFields).find(([, { attributeKeyPattern }]) => attributeKeyPattern?.test(fieldName)) ?? [];

  return mapping && field ? { field, mapping } : undefined;
};

export const isHighBoostGlobalField = ({ highBoostGlobalFields }: Pick<ResourceIndexDocumentMappings, 'highBoostGlobalFields'>, fieldName: string) =>
  highBoostGlobalFields.includes(fieldName);

export const isStringField = (fieldType: string): fieldType is 'keyword' | 'text' =>
  stringFieldTypes.includes(fieldType);

export const resourceIndexDocumentMappings: ResourceIndexDocumentMappings = {
  // This is a list of attribute names that should be given higher priority in search results.
  highBoostGlobalFields: ['description', 'province', 'city', 'targetPopulation', 'feeStructure'],

  mappingFields: {
    // TODO: this may change to a range field depending on discussion around what they really want to search for.
    // Is it likely that they want to put in a child age and find resources where the child age is between eligibilityMinAge and eligibilityMaxAge?
    // Having a range of ages and then passing in a range of ages to search for seems like a strange way to do it.
    eligibilityMinAge: {
      type: 'integer',
    },
    eligibilityMaxAge: {
      type: 'integer',
    },
    id: {
      type: 'keyword',
    },
    name: {
      type: 'text',
      hasLanguageFields: true,
      isArrayField: true,
      copyTo: ['nameCompletion'],
    },
    nameCompletion: {
      type: 'completion',
      hasLanguageFields: true,
      attributeKeyPattern: /^name$/,
    },
    feeStructure: {
      type: 'keyword',
    },
    targetPopulation: {
      type: 'keyword',
    },
    howIsServiceOffered: {
      type: 'keyword',
    },
    interpretationTranslationServicesAvailable: {
      type: 'boolean',
    },
    province: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /(.*)([pP])rovince$/,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        `${info?.name ?? ''} ${value}`,
    },
    city: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /(.*)[cC]ity$/,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        `${info?.name ?? ''} ${value}`,
    },
  },
  languageFields: {
    en: {
      type: 'text',
      analyzer: 'rebuilt_english',
    },
    fr: {
      type: 'text',
      analyzer: 'rebuilt_french',
    },
  },
};

export const getMappingFieldNamesByType = (targetType: MappingFieldType) => (
  Object.entries(resourceIndexDocumentMappings.mappingFields)
    .filter(([, { type }]) => type === targetType)
    .map(([fieldName]) => fieldName)
);

const convertStringMappingFieldToProperty = (key: string, property: MappingProperty, propConfig: MappingField): MappingProperty=> {
  const stringProperty = property as MappingTextProperty | MappingKeywordProperty;

  stringProperty.copy_to = isHighBoostGlobalField(resourceIndexDocumentMappings, key)
    ? ['high_boost_global']
    : ['low_boost_global'];

  if (propConfig.hasLanguageFields) {
    stringProperty.fields = resourceIndexDocumentMappings.languageFields;
  }

  if (propConfig.copyTo) {
    stringProperty.copy_to = [...stringProperty.copy_to, ...propConfig.copyTo];
  }

  return stringProperty as MappingProperty;
};

export const convertMappingFieldsToProperties = (): Record<string, MappingProperty> => {
  const properties: Record<string, MappingProperty> = {};

  Object.entries(resourceIndexDocumentMappings.mappingFields).map(([key, propConfig]) => {
    let property: MappingProperty = {};

    if (isStringField(propConfig.type)) {
      property = convertStringMappingFieldToProperty(key, property, propConfig);
    }

    property.type = propConfig.type;
    properties[key] = property;
  });

  return properties;
};
