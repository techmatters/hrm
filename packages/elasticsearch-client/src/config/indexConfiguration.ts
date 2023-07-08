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
import type { IndicesCreateRequest, SearchSuggester } from '@elastic/elasticsearch/lib/api/types';
import { CreateIndexConvertedDocument } from './index';
import { SuggestParameters } from '../suggest';

export type IndexConfiguration<T = any> = {
  getCreateIndexParams: (indexName: string) => IndicesCreateRequest
  convertToIndexDocument: (sourceEntity: T) => CreateIndexConvertedDocument
  generateSuggestQuery?: (suggestParameters: SuggestParameters) => SearchSuggester
};
