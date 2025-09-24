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
import type { AccountSID } from '@tech-matters/types';
import type {
  FlatResource,
  ReferrableResource,
  ReferrableResourceAttribute,
  ResourceAttributeNode,
} from '@tech-matters/resources-types';

import { getClient, SuggestParameters } from '@tech-matters/elasticsearch-client';

import { getById, getByIdList, getDistinctStringAttributes } from './resourceDataAccess';
import {
  RESOURCE_INDEX_TYPE,
  getSearchConfiguration,
} from '@tech-matters/resources-search-config';
import { getSsmParameter } from '@tech-matters/ssm-cache';

// Represents a resource whose ID was returned by a search, but which is not in the database
export type MissingResource = {
  id: string;
  name: string;
  _status: 'missing';
};

const isMissingResource = (
  resource: FlatResource | MissingResource,
): resource is MissingResource => '_status' in resource && resource._status === 'missing';

export type SimpleSearchParameters = {
  ids: string[];
  nameSubstring?: string;
  pagination: {
    limit: number;
    start: number;
  };
};

const MAX_SEARCH_RESULTS = 200;

const resourceRecordToApiResource = (
  resourceRecord: FlatResource,
): ReferrableResource => {
  const {
    stringAttributes,
    referenceStringAttributes,
    booleanAttributes,
    numberAttributes,
    dateTimeAttributes,
    lastUpdated,
    accountSid,
    ...withoutAttributes
  } = resourceRecord;
  const attributesWithKeys: (ReferrableResourceAttribute<string | boolean | number> & {
    key: string;
    list?: string;
  })[] = [
    ...stringAttributes,
    ...booleanAttributes,
    ...numberAttributes,
    ...dateTimeAttributes,
    ...referenceStringAttributes,
  ];
  const attributes: ResourceAttributeNode = {};
  attributesWithKeys.forEach(attribute => {
    const { key, list, ...withoutKey } = attribute;
    // Split on / but not on \/ (escaped /), but doesn't misinterpret preceding escaped \ (i.e. \\) as escaping the / (see unit tests)
    const attributeKeySections = key
      .split(/(?<!(?:[^\\]|^)\\(?:\\{2})*)\//)
      .filter(s => s.length);
    let currentObject: ResourceAttributeNode = attributes as ResourceAttributeNode;
    attributeKeySections.forEach((escapedSection, index) => {
      const section = escapedSection.replace(/\\([\\\/])/g, '$1');
      if (index === attributeKeySections.length - 1) {
        currentObject[section] = currentObject[section] || [];
        const currentValue = currentObject[section];
        if (Array.isArray(currentValue)) {
          currentValue.push(withoutKey);
        } else {
          // Workaround for when we attach a value to an intermediate node
          currentValue.__values__ = [...(currentValue.__values__ ?? []), withoutKey];
        }
      } else {
        currentObject[section] = currentObject[section] || {};
        const currentValue = currentObject[section];
        if (Array.isArray(currentValue)) {
          // Workaround for when we attach a value to an intermediate node
          currentObject[section] = { __values__: currentValue };
        }
      }
      currentObject = currentObject[section] as ResourceAttributeNode;
    });
  });

  return {
    ...withoutAttributes,
    attributes,
  };
};

// The full resource & the search result are synonyms for now, but the full resource should grow to be a superset
export type ReferrableResourceSearchResult = ReferrableResource | MissingResource;

export type SearchParameters = {
  filters?: Record<string, boolean | number | string | string[]>;
  generalSearchTerm: string;
  pagination: {
    limit: number;
    start: number;
  };
};

export const resourceService = () => {
  return {
    getResource: async (
      accountSid: AccountSID,
      resourceId: string,
    ): Promise<ReferrableResource | null> => {
      const record = await getById(accountSid, resourceId);
      return record ? resourceRecordToApiResource(record) : null;
    },

    searchResources: async (
      accountSid: AccountSID,
      searchParameters: SearchParameters,
    ): Promise<{ totalCount: number; results: ReferrableResourceSearchResult[] }> => {
      const limit = Math.min(
        MAX_SEARCH_RESULTS,
        searchParameters.pagination?.limit ?? Number.MAX_SAFE_INTEGER,
      );

      const boundedSearchParameters: SearchParameters = {
        ...searchParameters,
        filters: {
          ...searchParameters.filters,
          // exclude resources that are explicitly flagged as inactive. See resources-domain/packages/resources-search-config/index.ts filter mapping for more details on how this filter is generated.
          isActive: false,
        },
        pagination: { ...searchParameters.pagination!, limit },
      };

      const shortCode = await getSsmParameter(
        `/${process.env.NODE_ENV}/twilio/${accountSid}/short_helpline`,
      );
      const searchConfiguration = getSearchConfiguration(shortCode);

      const client = (
        await getClient({
          accountSid,
          indexType: RESOURCE_INDEX_TYPE,
          ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
        })
      ).searchClient(searchConfiguration);
      const { generalSearchTerm, ...esSearchParameters } = {
        ...boundedSearchParameters,
        q: boundedSearchParameters.generalSearchTerm,
      };
      const { total, items } = await client.search({
        searchParameters: esSearchParameters,
      });

      const orderedResourceIds: string[] = items.map(item => item.id);
      const unsortedResourceList = await getByIdList(accountSid, orderedResourceIds);
      const resourceMap = Object.fromEntries(
        unsortedResourceList.map(resource => [resource.id, resource]),
      );

      // Add ALL the resources found looking up specific IDs to the paginated block of name search results
      const orderedResults = items.map(
        ({ id, name }) => resourceMap[id] ?? { id, name, _status: 'missing' },
      );

      // Monitors & dashboards use this log statement, review them before updating to ensure they remain aligned.
      console.info(
        `[resource-search] AccountSid: ${accountSid} - Search Complete. Total count from ES: ${total}, Paginated count from ES: ${items.length}, Paginated count from DB: ${unsortedResourceList.length}.`,
      );

      return {
        results: orderedResults.map(record =>
          isMissingResource(record) ? record : resourceRecordToApiResource(record),
        ),
        totalCount: total,
      };
    },

    getResourceTermSuggestions: async (
      accountSid: AccountSID,
      suggestParameters: SuggestParameters,
    ) => {
      const shortCode = await getSsmParameter(
        `/${process.env.NODE_ENV}/twilio/${accountSid}/short_helpline`,
      );
      const searchConfiguration = getSearchConfiguration(shortCode);

      const client = (
        await getClient({
          accountSid,
          indexType: RESOURCE_INDEX_TYPE,
          ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
        })
      ).searchClient(searchConfiguration);

      return client.suggest({ suggestParameters });
    },

    getDistinctResourceStringAttributes: async (
      accountSid: AccountSID,
      key: string,
      language: string,
    ) => getDistinctStringAttributes(accountSid, key, language),
  };
};
