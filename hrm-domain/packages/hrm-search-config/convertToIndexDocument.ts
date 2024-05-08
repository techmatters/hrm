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

import { assertExhaustive, AccountSID } from '@tech-matters/types';
import type { CaseService, Contact } from '@tech-matters/hrm-types';
import {
  ContactDocument,
  CaseDocument,
  CasesContactsDocument,
  HRM_CASES_CONTACTS_INDEX_TYPE,
} from './hrmIndexDocumentMappings';
import { CreateIndexConvertedDocument } from '@tech-matters/elasticsearch-client';

type IndexContactMessage = {
  type: 'contact';
  contact: Contact;
};

type IndexCaseMessage = {
  type: 'case';
  case: Omit<CaseService, 'sections'> & {
    sections: NonNullable<CaseService['sections']>;
  };
};

export type IndexMessage = { accountSid: AccountSID } & (
  | IndexContactMessage
  | IndexCaseMessage
);

const getContactDocumentId = ({ contact, type }: IndexContactMessage) =>
  `${type}_${contact.id}`;

const getCaseDocumentId = ({ case: caseObj, type }: IndexCaseMessage) =>
  `${type}_${caseObj.id}`;

export const getContactParentId = (
  indexType: typeof HRM_CASES_CONTACTS_INDEX_TYPE,
  parentId?: string | number,
) => {
  if (indexType === HRM_CASES_CONTACTS_INDEX_TYPE) {
    return parentId ? `case_${parentId}` : '';
  }
};

export const getDocumentId = (m: IndexMessage) => {
  const { type } = m;
  switch (type) {
    case 'contact': {
      return getContactDocumentId(m);
    }
    case 'case': {
      return getCaseDocumentId(m);
    }
    default: {
      return assertExhaustive(type);
    }
  }
};

type IndexPayloadContact = IndexContactMessage & {
  transcript: NonNullable<string>;
};

type IndexPayloadCase = IndexCaseMessage;

export type IndexPayload = IndexPayloadContact | IndexPayloadCase;

const convertToContactDocument = ({
  type,
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
    caseId,
    number,
    channel,
    timeOfContact,
    twilioWorkerId,
    rawJson,
  } = contact;
  const compundId = getContactDocumentId({ type, contact });

  return {
    type,
    accountSid,
    id,
    compundId,
    createdAt,
    updatedAt: updatedAt ?? '',
    createdBy: createdBy ?? '',
    updatedBy: updatedBy ?? '',
    finalized: Boolean(finalizedAt),
    helpline: helpline ?? '',
    channel: channel ?? '',
    number: number ?? '',
    timeOfContact: timeOfContact ?? '',
    transcript,
    twilioWorkerId: twilioWorkerId ?? '',
    content: JSON.stringify(rawJson) ?? '',
    join_field: {
      name: 'contact',
      parent: getContactParentId(HRM_CASES_CONTACTS_INDEX_TYPE, caseId),
    },
    high_boost_global: '', // highBoostGlobal.join(' '),
    low_boost_global: '', // lowBoostGlobal.join(' '),
  };
};

const convertToCaseDocument = ({
  type,
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
  const compundId = getCaseDocumentId({ type, case: caseObj });

  const mappedSections: CaseDocument['sections'] = Object.entries(sections).flatMap(
    ([sectionType, sectionsArray]) =>
      sectionsArray.map(section => ({
        accountSid: accountSid as string,
        createdAt: section.createdAt,
        createdBy: section.createdBy,
        updatedAt: section.updatedAt ?? '',
        updatedBy: section.updatedBy ?? '',
        sectionId: section.sectionId,
        sectionType,
        content:
          typeof section.sectionTypeSpecificData === 'object'
            ? JSON.stringify(section.sectionTypeSpecificData)
            : section.sectionTypeSpecificData,
      })),
  );

  return {
    type,
    accountSid,
    id,
    compundId,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    helpline,
    twilioWorkerId,
    status,
    previousStatus: previousStatus ?? '',
    statusUpdatedAt: statusUpdatedAt ?? '',
    statusUpdatedBy: statusUpdatedBy ?? '',
    content: JSON.stringify(info) ?? '',
    sections: mappedSections,
    join_field: { name: 'case' },
    high_boost_global: '', // highBoostGlobal.join(' '),
    low_boost_global: '', // lowBoostGlobal.join(' '),
  };
};

export const convertToIndexDocument = (
  payload: IndexPayload,
): CreateIndexConvertedDocument<CasesContactsDocument> => {
  const { type } = payload;
  switch (type) {
    case 'contact': {
      return convertToContactDocument(payload);
    }
    case 'case': {
      return convertToCaseDocument(payload);
    }
    default: {
      return assertExhaustive(type);
    }
  }
};
