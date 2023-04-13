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

import { ReferrableResource } from '@tech-matters/types';

export type ResourcesIndexDocument = {
  name: string;
  text1: string[];
  text2: string[];
};

// This is a list of attribute names that should be given higher priority in search results.
const HIGH_PRIORITY_ATTRIBUTES = ['title'];

export const convertDocument = (resource: ReferrableResource): ResourcesIndexDocument => {
  const { name } = resource;

  // TODO: We may get better results if we join the array at index time instead of passing an array.
  // Scoring for field arrays is a little unpredictable.
  // We could also pass in a full field list as keywords and use a `copy_to` on the mapping
  // to copy to a single field that we use for search. This would allow us to filter on anything
  // and search on anything.
  const text1: string[] = [];
  const text2: string[] = [];

  const pushToCorrectField = (key: string, value: string) => {
    if (typeof value !== 'string') return;

    if (HIGH_PRIORITY_ATTRIBUTES.includes(key)) {
      text1.push(value);
    } else {
      text2.push(value);
    }
  };

  // TODO: this is leftover from an earlier iteration that was trying to divide things in a more complex way.
  // I just tried to remove it and ended up fighting with types for 30 minutes, so I'm leaving it for now.
  const parseAttribute = (key: string, attribute: any) => {
    pushToCorrectField(key, attribute.value);
  };

  Object.entries(resource.attributes).forEach(([key, attributes]) => {
    if (Array.isArray(attributes)) {
      return attributes.map(attribute => {
        parseAttribute(key, attribute);
      });
    }

    parseAttribute(key, attributes);
  });

  return {
    name,
    text1,
    text2,
  };
};
