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

import { Client } from '@elastic/elasticsearch';
import { SearchCompletionSuggestOption } from '@elastic/elasticsearch/lib/api/types';

export type SuggestParameters = {
  prefix: string;
  size: number;
};

export type SuggestExtraParams = {
  suggestParameters: SuggestParameters;
};

export type SuggestParams = {
  client: Client;
  index: string;
  suggestParameters: SuggestParameters;
  searchConfig: any;
};

export type SuggestResponseOption = {
  text: string;
  score: number;
};

export type SuggestResponseEntry = {
  text: string;
  length: number;
  options: SuggestResponseOption[];
};

export type SuggestResponse = Record<string, SuggestResponseEntry>;

export const suggest = async ({
  client,
  index,
  searchConfig,
  suggestParameters,
}: SuggestParams): Promise<SuggestResponse> => {
  const { generateSuggestQuery } = searchConfig;

  const suggestQuery = {
    index,
    _source: false, // disable return of source document info to improve response time
    suggest: generateSuggestQuery(suggestParameters),
  };

  const res = await client.search(suggestQuery);
  const suggestions: SuggestResponse = {};

  if (!res.suggest) {
    return suggestions;
  }

  Object.entries(res.suggest).forEach(([key, value]) => {
    const options = value[0].options as SearchCompletionSuggestOption[];
    suggestions[key] = {
      text: value[0].text,
      length: value[0].length,
      options: options.map(option => ({
        text: option.text,
        score: option._score!,
      })),
    };
  });

  console.dir(suggestions);

  return suggestions;
};
