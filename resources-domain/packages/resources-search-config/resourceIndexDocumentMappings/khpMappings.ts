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

import type { ReferrableResourceAttribute } from '@tech-matters/resources-types';
import { ResourceIndexDocumentMappings } from './resourceIndexDocumentMappings';
import { ResourcesSearchConfiguration } from '../searchConfiguration';

const resourceIndexDocumentMappings: ResourceIndexDocumentMappings = {
  // This is a list of attribute names that should be given higher priority in search results.
  highBoostGlobalFields: [
    'description',
    'primaryLocationProvince',
    'primaryLocationRegion',
    'primaryLocationRegionCity',
    'targetPopulation',
    'languages',
    'feeStructure',
    'taxonomyLevelName',
    'coverage',
  ],

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
    isActive: {
      type: 'boolean',
      indexValueGenerator: attribute =>
        attribute.value !== undefined ? Boolean(attribute.value) : true,
    },
    name: {
      type: 'text',
      hasLanguageFields: true,
      isArrayField: true,
    },
    taxonomyLevelName: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /^taxonomies\/.*$/,
    },
    taxonomyLevelNameCompletion: {
      type: 'completion',
      isArrayField: true,
      attributeKeyPattern: /^taxonomies\/.*$/,
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
    languages: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /^languages\/.*$/,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        [info?.language, value].filter(i => i).join(' '),
    },
    province: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /(.*)([pP])rovince$/,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        [info?.name, value].filter(i => i).join(' '),
    },
    city: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /(.*)[cC]ity$/,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        [info?.name, value].filter(i => i).join(' '),
    },
    region: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /(.*)[rR]egion$/,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        [info?.name, value].filter(i => i).join(' '),
    },
    coverage: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /^coverage\/.*$/,
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

const filterMappings: ResourcesSearchConfiguration['filterMappings'] = {
  minEligibleAge: {
    type: 'range',
    targetField: 'eligibilityMaxAge',
    operator: 'gte',
  },
  maxEligibleAge: {
    type: 'range',
    targetField: 'eligibilityMinAge',
    operator: 'lte',
  },
  interpretationTranslationServicesAvailable: {
    type: 'term',
  },
  isActive: {
    type: 'custom',
    filterGenerator: value => ({
      bool: {
        must_not: {
          term: { isActive: value },
        },
      },
    }),
  },
};

export default { resourceIndexDocumentMappings, filterMappings };
