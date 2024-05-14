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
import type { Script } from '@elastic/elasticsearch/lib/api/types';
import { assertExhaustive } from '@tech-matters/types';
import { CreateIndexConvertedDocument } from '@tech-matters/elasticsearch-client';
import { IndexPayload, IndexPayloadContact } from './payload';
import {
  CaseDocument,
  ContactDocument,
  HRM_CASES_INDEX_TYPE,
} from './hrmIndexDocumentMappings';
import { convertContactToContactDocument } from './convertToIndexDocument';

const convertContactToCaseScriptUpdate = (
  payload: IndexPayloadContact,
): {
  documentUpdate: CreateIndexConvertedDocument<CaseDocument>;
  scriptUpdate: Script;
} => {
  const { operation } = payload;
  const { accountSid, caseId } = payload.contact;

  switch (operation) {
    case 'index': {
      const contactDocument = convertContactToContactDocument(payload);

      const documentUpdate: CreateIndexConvertedDocument<CaseDocument> = {
        id: parseInt(caseId!, 10),
        accountSid,
        contacts: [contactDocument],
      };

      const scriptUpdate: Script = {
        source:
          'def replaceContact(Map newContact, List contacts) { contacts.removeIf(contact -> contact.id == newContact.id); contacts.add(newContact); } replaceContact(params.newContact, ctx._source.contacts);',
        params: {
          newContact: contactDocument,
        },
      };

      return { documentUpdate, scriptUpdate };
    }
    case 'remove': {
      const scriptUpdate: Script = {
        source:
          'def removeContact(int contactId, List contacts) { contacts.removeIf(contact -> contact.id == contactId); } removeContact(params.contactId, ctx._source.contacts);',
        params: {
          contactId: payload.contact.id,
        },
      };

      return { documentUpdate: {}, scriptUpdate };
    }
    default: {
      return assertExhaustive(operation);
    }
  }
};

const convertToCaseScriptUpdate = (
  payload: IndexPayload,
): {
  documentUpdate: CreateIndexConvertedDocument<CaseDocument>;
  scriptUpdate: Script;
} => {
  if (payload.type === 'contact') {
    return convertContactToCaseScriptUpdate(payload);
  }

  throw new Error(
    `convertToCaseScriptDocument not implemented for type ${payload.type} and operation ${payload.operation}`,
  );
};

export const convertToScriptUpdate = (
  payload: IndexPayload,
  indexName: string,
): {
  documentUpdate: CreateIndexConvertedDocument<ContactDocument | CaseDocument>;
  scriptUpdate: Script;
} => {
  if (indexName.endsWith(HRM_CASES_INDEX_TYPE)) {
    return convertToCaseScriptUpdate(payload);
  }

  throw new Error(`convertToScriptDocument not implemented for index ${indexName}`);
};
