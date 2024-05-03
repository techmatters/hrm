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

import { IndexPayload, convertToIndexDocument } from './convertToIndexDocument';
import { getCreateIndexParams } from './getCreateIndexParams';
import type {
  IndexConfiguration,
  SearchConfiguration,
} from '@tech-matters/elasticsearch-client';

export type { IndexPayload } from './convertToIndexDocument';
// export type { IndexPayload, IndexMessage } from './convertToIndexDocument';

export const hrmSearchConfiguration: SearchConfiguration = {
  searchFieldBoosts: {
    // 'name.*': 5,
    // 'id.*': 5,
    // 'high_boost_global.*': 3,
    // 'low_boost_global.*': 2,
    '*': 1,
    '*.*': 1,
  },
  filterMappings: {},
  // generateSuggestQuery,
};

export const hrmIndexConfiguration: IndexConfiguration<IndexPayload> = {
  convertToIndexDocument,
  getCreateIndexParams,
};
