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

import { convertToIndexDocument } from './convertToIndexDocument';
import { convertToScriptUpdate } from './convertToScriptUpdate';
import { getCreateIndexParams } from './getCreateIndexParams';
import {
  SearchParameters,
  generateElasticsearchQuery,
} from './generateElasticsearchQuery';
import type {
  IndexConfiguration,
  SearchConfiguration,
} from '@tech-matters/elasticsearch-client';
import { IndexPayload } from './payload';

export {
  HRM_CASES_INDEX_TYPE,
  HRM_CONTACTS_INDEX_TYPE,
} from './hrmIndexDocumentMappings';
export {
  IndexMessage,
  IndexCaseMessage,
  IndexContactMessage,
  IndexPayload,
} from './payload';

export const hrmSearchConfiguration: SearchConfiguration<SearchParameters> = {
  generateElasticsearchQuery,
  // generateSuggestQuery,
};

export const hrmIndexConfiguration: IndexConfiguration<IndexPayload> = {
  convertToIndexDocument,
  convertToScriptUpdate,
  getCreateIndexParams,
};

export {
  generateESFilter,
  GenerateContactFilterParams,
  GenerateCaseFilterParams,
  FILTER_ALL_CLAUSE,
  casePathToContacts,
} from './generateElasticsearchQuery';
