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
import type { PropertyName, MappingProperty } from '@elastic/elasticsearch/lib/api/types';
import { ReferrableResourceAttribute } from '@tech-matters/types/dist/Resources';

export type MappingField = {
  type: 'integer' | 'keyword' | 'text' | 'boolean';
  hasLanguageFields?: boolean;
  isArrayField?: boolean;
  attributeKeyPattern?: RegExp;
  indexValueGenerator?: (attribute: ReferrableResourceAttribute<any>) => boolean | string | number;
};

export type ResourceIndexDocumentMappings = {
  highBoostGlobalFields: string[];
  mappingFields: {
    [key: string]: MappingField;
  };
  languageFields: Record<PropertyName, MappingProperty>
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
  if (Object.keys(mappingFields).includes(fieldName)) return { field: fieldName, mapping:mappingFields[fieldName] };
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
      type: 'keyword',
      hasLanguageFields: true,
      isArrayField: true,
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