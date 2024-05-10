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
import type { CaseService, Contact } from '@tech-matters/hrm-types';
import { assertExhaustive, AccountSID } from '@tech-matters/types';
import {
  ContactDocument,
  CaseDocument,
  HRM_CONTACTS_INDEX_TYPE,
  HRM_CASES_INDEX_TYPE,
} from './hrmIndexDocumentMappings';
import { CreateIndexConvertedDocument } from '@tech-matters/elasticsearch-client';

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

type IndexPayloadContact = IndexContactMessage & {
  transcript: NonNullable<string>;
};

type IndexPayloadCase = IndexCaseMessage;

export type IndexPayload = IndexPayloadContact | IndexPayloadCase;

const filterEmpty = <T extends CaseDocument | ContactDocument>(doc: T): T =>
  Object.entries(doc).reduce((accum, [key, value]) => {
    if (value) {
      return { ...accum, [key]: value };
    }

    return accum;
  }, {} as T);

const convertContactToContactDocument = ({
  contact,
  transcript,
}: IndexPayloadContact): CreateIndexConvertedDocument<ContactDocument> => {
  const {
    accountSid,
    id,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    finalizedAt,
    helpline,
    number,
    channel,
    timeOfContact,
    twilioWorkerId,
    rawJson,
  } = contact;

  const contactDocument: ContactDocument = {
    accountSid,
    id,
    createdAt,
    updatedAt: updatedAt,
    createdBy: createdBy,
    updatedBy: updatedBy,
    finalized: Boolean(finalizedAt),
    helpline: helpline,
    channel: channel,
    number: number,
    timeOfContact: timeOfContact,
    transcript,
    twilioWorkerId: twilioWorkerId,
    content: JSON.stringify(rawJson),
    // high_boost_global: '', // highBoostGlobal.join(' '),
    // low_boost_global: '', // lowBoostGlobal.join(' '),
  };

  return filterEmpty(contactDocument);
};

const convertCaseToCaseDocument = ({
  case: caseObj,
}: IndexPayloadCase): CreateIndexConvertedDocument<CaseDocument> => {
  const {
    accountSid,
    id,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    helpline,
    twilioWorkerId,
    previousStatus,
    status,
    statusUpdatedAt,
    statusUpdatedBy,
    sections,
    info,
  } = caseObj;
  const mappedSections: CaseDocument['sections'] = Object.entries(sections).flatMap(
    ([sectionType, sectionsArray]) =>
      sectionsArray.map(section => ({
        accountSid: accountSid as string,
        createdAt: section.createdAt,
        createdBy: section.createdBy,
        updatedAt: section.updatedAt,
        updatedBy: section.updatedBy,
        sectionId: section.sectionId,
        sectionType,
        content:
          typeof section.sectionTypeSpecificData === 'object'
            ? JSON.stringify(section.sectionTypeSpecificData)
            : section.sectionTypeSpecificData,
      })),
  );

  const caseDocument: CaseDocument = {
    accountSid,
    id,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    helpline,
    twilioWorkerId,
    status,
    previousStatus: previousStatus,
    statusUpdatedAt: statusUpdatedAt,
    statusUpdatedBy: statusUpdatedBy,
    content: JSON.stringify(info),
    sections: mappedSections,
    contacts: null,
    // high_boost_global: '', // highBoostGlobal.join(' '),
    // low_boost_global: '', // lowBoostGlobal.join(' '),
  };

  return filterEmpty(caseDocument);
};

const convertToContactIndexDocument = (payload: IndexPayload) => {
  if (payload.type === 'contact') {
    return convertContactToContactDocument(payload);
  }

  throw new Error(
    `convertToContactIndexDocument not implemented for type ${payload.type} and operation ${payload.operation}`,
  );
};

const convertToCaseIndexDocument = (payload: IndexPayload) => {
  if (payload.type === 'case') {
    return convertCaseToCaseDocument(payload);
  }

  throw new Error(
    `convertToCaseIndexDocument not implemented for type ${payload.type} and operation ${payload.operation}`,
  );
};

export const convertToIndexDocument = (
  payload: IndexPayload,
  indexName: string,
): CreateIndexConvertedDocument<ContactDocument | CaseDocument> => {
  if (indexName.endsWith(HRM_CONTACTS_INDEX_TYPE)) {
    return convertToContactIndexDocument(payload);
  }

  if (indexName.endsWith(HRM_CASES_INDEX_TYPE)) {
    return convertToCaseIndexDocument(payload);
  }

  throw new Error(`convertToIndexDocument not implemented for index ${indexName}`);
};

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
        id: parseInt(caseId, 10),
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

      return { documentUpdate: undefined, scriptUpdate };
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
