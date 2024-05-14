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
import type { CaseService, Contact } from '@tech-matters/hrm-types';
import { AccountSID } from '@tech-matters/types';

type IndexOperation = 'index' | 'remove';

type IndexContactMessage = {
  type: 'contact';
  operation: IndexOperation;
  contact: Pick<Contact, 'id'> & Partial<Contact>;
};

type IndexCaseMessage = {
  type: 'case';
  operation: IndexOperation;
  case: Pick<CaseService, 'id'> &
    Partial<Omit<CaseService, 'sections'>> & {
      sections: NonNullable<CaseService['sections']>;
    };
};

export type IndexMessage = { accountSid: AccountSID } & (
  | IndexContactMessage
  | IndexCaseMessage
);

export type IndexPayloadContact = IndexContactMessage & {
  transcript: NonNullable<string>;
};

export type IndexPayloadCase = IndexCaseMessage;

export type IndexPayload = IndexPayloadContact | IndexPayloadCase;
