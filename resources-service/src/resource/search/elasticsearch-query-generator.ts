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

import { AccountSID } from '@tech-matters/twilio-worker-auth';

import { SearchParametersEs, SearchQuery, SearchQueryFilters } from './search-types';

const KHP_ES_FIELDS = ['text_1.*^3', 'text_2.*^2'];

const generateFilters = (filters: SearchParametersEs['filters']): SearchQueryFilters => {
  const returnFilters: SearchQueryFilters = [];

  if (!filters?.length) return returnFilters;

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      returnFilters.push({
        terms: {
          [key]: value,
        },
      });
    } else {
      returnFilters.push({
        term: {
          [key as string]: value,
        },
      });
    }
  });

  return returnFilters;
};

const generateElasticsearchQuery = (
  accountSid: AccountSID,
  searchParameters: SearchParametersEs,
) => {
  const { q, filters, pagination } = searchParameters;
  const { limit, start } = pagination;

  const query: SearchQuery = {
    index: `${accountSid}-resources`,
    body: {
      query: {
        bool: {
          must: [
            {
              query_string: {
                query: q,
                fields: KHP_ES_FIELDS,
              },
            },
          ],
        },
      },
      from: start,
      size: limit,
    },
  };

  if (filters) {
    query.body.query.bool.filter = generateFilters(filters);
  }

  return query;
};

export default generateElasticsearchQuery;
