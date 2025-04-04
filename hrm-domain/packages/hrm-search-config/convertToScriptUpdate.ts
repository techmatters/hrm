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
import type { Script } from '@elastic/elasticsearch/lib/api/types';
import { CreateIndexConvertedDocument } from '@tech-matters/elasticsearch-client';
import { DeleteContactMessage, IndexPayload, IndexPayloadContact } from './payload';
import {
  CaseDocument,
  ContactDocument,
  HRM_CASES_INDEX_TYPE,
} from './hrmIndexDocumentMappings';
import { convertContactToContactDocument } from './convertToIndexDocument';

const convertContactToCaseScriptUpdate = (
  payload: IndexPayloadContact | DeleteContactMessage,
): {
  documentUpdate: CreateIndexConvertedDocument<CaseDocument>;
  scriptUpdate: Script;
} => {
  switch (payload.operation) {
    case 'create':
    case 'update':
    case 'reindex': {
      const { accountSid, caseId } = payload.contact;
      const contactDocument = convertContactToContactDocument(payload);

      const documentUpdate: CreateIndexConvertedDocument<CaseDocument> = {
        id: caseId!.toString(),
        accountSid,
        contacts: [contactDocument],
      };

      const scriptUpdate: Script = {
        source: `
          def replaceContact(Map newContact, Map _source) {
            if (_source.containsKey('contacts') && _source.contacts != null) {
              _source.contacts.removeIf(contact -> contact.id == newContact.id);
              _source.contacts.add(newContact);
            } else {
              _source.contacts = [newContact];
            }
          }

          replaceContact(params.newContact, ctx._source);
        `,
        params: {
          newContact: contactDocument,
        },
      };

      return { documentUpdate, scriptUpdate };
    }
    case 'delete': {
      // Compatibility with old messages that don't have a message.id field, can be removed once HRM v1.26.0 is deployed
      const contactId = payload.id ?? (payload as any).contact?.id;
      const scriptUpdate: Script = {
        source:
          'def removeContact(String contactId, List contacts) { contacts.removeIf(contact -> contact.id == contactId); } removeContact(params.contactId, ctx._source.contacts);',
        params: {
          contactId: contactId.toString(),
        },
      };

      return { documentUpdate: {}, scriptUpdate };
    }
  }
};

const convertToCaseScriptUpdate = (
  payload: IndexPayload,
): {
  documentUpdate: CreateIndexConvertedDocument<CaseDocument>;
  scriptUpdate: Script;
} => {
  if (payload.entityType === 'contact') {
    return convertContactToCaseScriptUpdate(payload);
  }

  throw new Error(
    `convertToCaseScriptDocument not implemented for type ${payload.entityType} and operation ${payload.operation}`,
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
