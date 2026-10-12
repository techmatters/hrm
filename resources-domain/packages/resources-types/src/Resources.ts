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
import { AccountSID } from '@tech-matters/types';
import { HrmAccountId } from '@tech-matters/types';

export type TimeSequence = `${number}-${number}`;

export type ReferrableResourceAttribute<T> = {
  value: T;
  info?: any;
};

export const isReferrableResourceAttribute = (
  attribute: any,
): attribute is ReferrableResourceAttribute<unknown> =>
  attribute &&
  (typeof attribute.value === 'string' ||
    typeof attribute.value === 'number' ||
    typeof attribute.value === 'boolean');

export type ReferrableResourceTranslatableAttribute =
  ReferrableResourceAttribute<string> & {
    language: string;
  };

export type ResourceAttributeNode = Record<
  string,
  | (
      | ReferrableResourceAttribute<string | boolean | number>
      | ReferrableResourceTranslatableAttribute
    )[]
  | Record<
      string,
      (
        | ReferrableResourceAttribute<string | boolean | number>
        | ReferrableResourceTranslatableAttribute
      )[]
    >
>;

export type ReferrableResource = {
  name: string;
  id: string;
  attributes: ResourceAttributeNode;
};

export const enum ResourcesJobType {
  SEARCH_INDEX = 'search-index',
}

type ResourcesJobMessageCommons = {
  accountSid: HrmAccountId;
};

export type ResourcesSearchIndexPayload = ResourcesJobMessageCommons & {
  jobType: ResourcesJobType.SEARCH_INDEX;
  accountSid: string;
  document: FlatResource;
};

export type FlatResource = {
  accountSid: AccountSID;
  name: string;
  id: string;
  lastUpdated: string;
  deletedAt?: string;
  importSequenceId?: TimeSequence;
  stringAttributes: (ReferrableResourceTranslatableAttribute & { key: string })[];
  referenceStringAttributes: (ReferrableResourceTranslatableAttribute & {
    key: string;
    list: string;
  })[];
  booleanAttributes: (ReferrableResourceAttribute<boolean> & { key: string })[];
  numberAttributes: (ReferrableResourceAttribute<number> & { key: string })[];
  dateTimeAttributes: (ReferrableResourceAttribute<string> & { key: string })[];
};
