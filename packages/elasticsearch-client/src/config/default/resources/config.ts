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

export type ResourcesCreateIndexConvertedDocument = {
  high_boost_global: string;
  low_boost_global: string;
  [key: string]: number | string | string[];
};

// List of field types that should be treated as strings.
const stringFieldTypes = ['text', 'keyword'];

// List of searchable fields used to build the ES search query.
export const searchFields = [
  'name.*^4',
  'keywords.*^4',
  'high_boost_global.*^3',
  'low_boost_global.*^2',
  '*',
  '*.*',
];

// This is a list of attribute names that should be given higher priority in search results.
export const highBoostGlobalFields = ['title'];

export const mappingFields: {
  [key: string]: {
    type: 'integer' | 'keyword' | 'text';
    hasLanguageFields?: boolean;
    isArrayField?: boolean;
  };
} = {
  // TODO: this may change to a range field depending on discussion around what they really want to search for.
  // Is it likely that they want to put in a child age and find resources where the child age is between eligibilityMinAge and eligibilityMaxAge?
  // Having a range of ages and then passing in a range of ages to search for seems like a strange way to do it.
  eligibilityMinAge: {
    type: 'integer',
    hasLanguageFields: true,
  },
  eligibilityMaxAge: {
    type: 'integer',
  },
  name: {
    type: 'keyword',
    hasLanguageFields: true,
  },
  feeStructure: {
    type: 'keyword',
    hasLanguageFields: true,
  },
  keywords: {
    type: 'keyword',
    isArrayField: true,
  },
  province: {
    type: 'keyword',
  },
  city: {
    type: 'keyword',
  },
};

export const isMappingField = (fieldName: string) => Object.keys(mappingFields).includes(fieldName);
export const isHighBoostGlobalField = (fieldName: string) =>
  highBoostGlobalFields.includes(fieldName);
export const isStringField = (fieldType: string): fieldType is 'keyword' | 'text' =>
  stringFieldTypes.includes(fieldType);
