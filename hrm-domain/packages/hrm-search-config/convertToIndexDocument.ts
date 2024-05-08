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

import { assertExhaustive } from '@tech-matters/types';
import type { Contact } from '../../hrm-core/contact/contactService';
import type { CaseService } from '../../hrm-core/case/caseService';
// import type { Contact } from '@tech-matters/hrm-core/contact/contactService';
// import type { CaseService } from '@tech-matters/hrm-core/case/caseService';
import type {
  ContactDocument,
  CaseDocument,
  CasesContactsDocument,
} from './hrmIndexDocumentMappings';
import { CreateIndexConvertedDocument } from '@tech-matters/elasticsearch-client';

type IndexPayloadContact = {
  type: 'contact';
  contact: Contact;
  transcript?: string;
};

type IndexPayloadCase = {
  type: 'case';
  case: Omit<CaseService, 'sections'> & {
    sections: NonNullable<CaseService['sections']>;
  };
};

export type IndexPayload = IndexPayloadContact | IndexPayloadCase;

const convertToContactDocument = ({
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
  const type = 'contact' as const;
  const compundId = `${type}_${id}`;

  return {
    type,
    accountSid,
    id,
    compundId,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    finalized: Boolean(finalizedAt),
    helpline,
    channel,
    number,
    timeOfContact,
    transcript,
    twilioWorkerId,
    content: typeof rawJson === 'object' ? JSON.stringify(rawJson) : rawJson,
    join_field: { name: 'contact', ...(caseId && { parent: `case_${caseId}` }) },
    high_boost_global: '', // highBoostGlobal.join(' '),
    low_boost_global: '', // lowBoostGlobal.join(' '),
  };
};

const convertToCaseDocument = ({
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
  const type = 'case' as const;
  const compundId = `${type}_${id}`;

  const mappedSections: CaseDocument['sections'] = Object.entries(sections).flatMap(
    ([sectionType, sectionsArray]) =>
      sectionsArray.map(section => ({
        accountSid: accountSid as string,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
        createdBy: section.createdBy,
        updatedBy: section.updatedBy,
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
    previousStatus,
    status,
    statusUpdatedAt,
    statusUpdatedBy,
    content: typeof info === 'object' ? JSON.stringify(info) : info,
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
      assertExhaustive(type);
    }
  }
};
