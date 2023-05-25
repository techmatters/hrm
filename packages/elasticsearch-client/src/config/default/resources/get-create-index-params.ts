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

import { IndicesCreateRequest } from '@elastic/elasticsearch/lib/api/types';
import {
  IndexConfiguration,
  isHighBoostGlobalField,
  isStringField,
} from '../../indexConfiguration';

// TODO: when we have more than one index and config type, we should probably make this a little more generic
// and just import the config to generate it. Leaving here for now.
export const getCreateIndexParams = (
  indexConfig: Omit<IndexConfiguration, 'getCreateIndexParams'>,
): IndicesCreateRequest => {
  const { indexName: index, mappingFields, languageFields } = indexConfig;
  const createRequest: IndicesCreateRequest = {
    index,
    settings: {
      analysis: {
        filter: {
          english_stemmer: {
            type: 'stemmer',
            language: 'english',
          },
          french_stemmer: {
            type: 'stemmer',
            language: 'french',
          },
        },
        analyzer: {
          rebuilt_english: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'english_stemmer'],
          },
          rebuilt_french: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'french_stemmer'],
          },
        },
      },
    },
    mappings: {
      properties: {
        high_boost_global: {
          type: 'text',
          fields: languageFields,
        },
        low_boost_global: {
          type: 'text',
          fields: languageFields,
        },
      },
    },
  };

  Object.entries(mappingFields).forEach(([key, value]) => {
    createRequest!.mappings!.properties![key] = {
      type: value.type,
    };

    if (!isStringField(value.type)) return;

    const property: any = createRequest!.mappings!.properties![key];
    property.copy_to = isHighBoostGlobalField(indexConfig, key)
      ? 'high_boost_global'
      : 'low_boost_global';

    if (value.hasLanguageFields) {
      property.fields = languageFields;
    }
  });

  return createRequest;
};
