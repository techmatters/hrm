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

import {
  ContactDocument,
  CaseDocument,
  HRM_CONTACTS_INDEX_TYPE,
  HRM_CASES_INDEX_TYPE,
} from './hrmIndexDocumentMappings';
import { CreateIndexConvertedDocument } from '@tech-matters/elasticsearch-client';
import { IndexPayload, IndexPayloadCase, IndexPayloadContact } from './payload';

const filterEmpty = <T extends CaseDocument | ContactDocument>(doc: T): T =>
  Object.entries(doc).reduce((accum, [key, value]) => {
    if (value) {
      return { ...accum, [key]: value };
    }

    return accum;
  }, {} as T);

export const convertContactToContactDocument = ({
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
    previousStatus,
    statusUpdatedAt,
    statusUpdatedBy,
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
