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
import {
  IndexConfiguration,
  SearchConfiguration,
} from '@tech-matters/elasticsearch-client';
import { FlatResource } from '@tech-matters/types';
import { convertIndexDocument } from './convertIndexDocument';
import { getCreateIndexParams } from './getCreateIndexParams';
import { generateSuggestQuery } from './generateSuggestQuery';
import { ResourcesSearchConfiguration } from './searchConfiguration';
import {
  SearchParameters,
  generateElasticsearchQuery,
} from './generateElasticsearchQuery';

const resourceSearchConfiguration: ResourcesSearchConfiguration = {
  searchFieldBoosts: {
    'name.*': 5,
    'id.*': 5,
    'high_boost_global.*': 3,
    'low_boost_global.*': 2,
    '*': 1,
    '*.*': 1,
  },
  filterMappings: {
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
  },
  generateSuggestQuery,
};

export { SearchParameters };

export const searchConfiguration: SearchConfiguration<SearchParameters> = {
  generateElasticsearchQuery: generateElasticsearchQuery(resourceSearchConfiguration),
  generateSuggestQuery: resourceSearchConfiguration.generateSuggestQuery,
};

export const resourceIndexConfiguration: IndexConfiguration<FlatResource> = {
  convertToIndexDocument: convertIndexDocument,
  getCreateIndexParams,
};

export const RESOURCE_INDEX_TYPE = 'resources';
