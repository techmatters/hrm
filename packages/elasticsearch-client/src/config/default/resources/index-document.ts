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

const HIGH_PRIORITY_ATTRIBUTES = ['title'];

export const convertDocument = (resource: ReferrableResource): ResourcesIndexDocument => {
  const { name } = resource;

  const text1: string[] = [];

  const text2: string[] = [];

  const pushToCorrectText = (key: string, value: string) => {
    if (HIGH_PRIORITY_ATTRIBUTES.includes(key)) {
      text1.push(value);
    } else {
      text2.push(value);
    }
  };

  const parseAttribute = (key: string, attribute: any) => {
    pushToCorrectText(key, attribute.value);
  };

  Object.entries(resource.attributes).map(([key, attributes]) => {
    if (!Array.isArray(attributes)) {
      return parseAttribute(key, attributes);
    }

    attributes.map(attribute => {
      parseAttribute(key, attribute);
    });
  });

  return {
    name,
    text1,
    text2,
  };
};
