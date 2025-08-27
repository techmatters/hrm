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

import { SearchSuggester } from '@elastic/elasticsearch/lib/api/types';
import { SuggestParameters } from '@tech-matters/elasticsearch-client';
import {
  getMappingFieldNamesByType,
  ResourceIndexDocumentMappings,
} from './resourceIndexDocumentMappings';

// TODO: this should probably be moved to the elasticsearch-client package, but the config/client splitting
// makes it a bit tricky to do that right now.
export const generateSuggestQuery =
  (mappings: ResourceIndexDocumentMappings) =>
  ({ prefix, size }: SuggestParameters): SearchSuggester => {
    const suggestQuery: SearchSuggester = {};

    getMappingFieldNamesByType(mappings)('completion').forEach((fieldName: string) => {
      suggestQuery[fieldName] = {
        prefix,
        completion: {
          field: fieldName,
          size,
          skip_duplicates: true,
        },
      };
    });

    return suggestQuery;
  };
