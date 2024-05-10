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

/**
 * This is a very early example of a rudimentary configuration for a multi-language index in ES.
 *
 * There is a lot of room for improvement here to allow more robust use of the ES query string
 * syntax, but this is a start that gets us close to the functionality we scoped out for cloudsearch.
 *
 * see: https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html
 */

import type { IndicesCreateRequest } from '@elastic/elasticsearch/lib/api/types';

import {
  HRM_CASES_INDEX_TYPE,
  HRM_CONTACTS_INDEX_TYPE,
  caseMapping,
  contactMapping,
} from './hrmIndexDocumentMappings';

const getCreateHrmContactsIndexParams = (index: string): IndicesCreateRequest => {
  return {
    index,
    // settings: {
    // },
    mappings: {
      properties: {
        high_boost_global: {
          type: 'text',
        },
        low_boost_global: {
          type: 'text',
        },
        ...contactMapping,
      },
    },
  };
};

const getCreateHrmCaseIndexParams = (index: string): IndicesCreateRequest => {
  return {
    index,
    // settings: {
    // },
    mappings: {
      properties: {
        high_boost_global: {
          type: 'text',
        },
        low_boost_global: {
          type: 'text',
        },
        ...caseMapping,
      },
    },
  };
};

/**
 * This function is used to make a request to create the resources search index in ES.
 * @param index
 */
export const getCreateIndexParams = (index: string): IndicesCreateRequest => {
  if (index.endsWith(HRM_CONTACTS_INDEX_TYPE)) {
    return getCreateHrmContactsIndexParams(index);
  }

  if (index.endsWith(HRM_CASES_INDEX_TYPE)) {
    return getCreateHrmCaseIndexParams(index);
  }

  throw new Error(`getCreateIndexParams not implemented for index ${index}`);
};
