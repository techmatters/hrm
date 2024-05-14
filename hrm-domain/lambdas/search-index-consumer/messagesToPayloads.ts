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

import {
  HRM_CASES_INDEX_TYPE,
  HRM_CONTACTS_INDEX_TYPE,
  type IndexPayload,
} from '@tech-matters/hrm-search-config';
import { assertExhaustive, type AccountSID } from '@tech-matters/types';
import type { MessageWithMeta, MessagesByAccountSid } from './messages';

/**
 * A payload is single object that should be indexed in a particular index. A single message might represent multiple payloads.
 * The indexHandler represents the operation that should be used when indexing the given document:
 *   - indexDocument: Used when we don't care overriding the previous versions of the document. An example is when a document is created for the first time
 *   - updateDocument: Used when we want to preserve the existing document (if any), using the document object for the update. An example is update a case
 *   - updateScript: Used when we want to preserve the existing document (if any), using the generated "update script" for the update. An example is updating case.contacts list when a contact is indexed
 */
export type PayloadWithMeta = {
  documentId: number;
  payload: IndexPayload;
  messageId: string;
  indexHandler: 'indexDocument' | 'updateDocument' | 'updateScript';
};
export type PayloadsByIndex = {
  [indexType: string]: PayloadWithMeta[];
};
export type PayloadsByAccountSid = Record<AccountSID, PayloadsByIndex>;

// TODO: Pull the transcripts from S3 (if any)
const generatePayloadFromContact = (
  ps: PayloadsByIndex,
  m: MessageWithMeta & { message: { type: 'contact' } },
): PayloadsByIndex => ({
  ...ps,
  // add an upsert job to HRM_CONTACTS_INDEX_TYPE index
  [HRM_CONTACTS_INDEX_TYPE]: [
    ...(ps[HRM_CONTACTS_INDEX_TYPE] ?? []),
    {
      ...m,
      documentId: m.message.contact.id,
      payload: { ...m.message, transcript: '' },
      indexHandler: 'updateDocument',
    },
  ],
  // if associated to a case, add an upsert with script job to HRM_CASES_INDEX_TYPE index
  [HRM_CASES_INDEX_TYPE]: m.message.contact.caseId
    ? [
        ...(ps[HRM_CASES_INDEX_TYPE] ?? []),
        {
          ...m,
          documentId: parseInt(m.message.contact.caseId, 10),
          payload: { ...m.message, transcript: '' },
          indexHandler: 'updateScript',
        },
      ]
    : ps[HRM_CASES_INDEX_TYPE] ?? [],
});

const generatePayloadFromCase = (
  ps: PayloadsByIndex,
  m: MessageWithMeta & { message: { type: 'case' } },
): PayloadsByIndex => ({
  ...ps,
  // add an upsert job to HRM_CASES_INDEX_TYPE index
  [HRM_CASES_INDEX_TYPE]: [
    ...(ps[HRM_CASES_INDEX_TYPE] ?? []),
    {
      ...m,
      documentId: m.message.case.id,
      payload: { ...m.message },
      indexHandler: 'updateDocument',
    },
  ],
});

const messagesToPayloadReducer = (
  accum: PayloadsByIndex,
  currM: MessageWithMeta,
): PayloadsByIndex => {
  const { message, messageId } = currM;

  const { type } = message;

  switch (type) {
    case 'contact': {
      return generatePayloadFromContact(accum, { message, messageId });
    }
    case 'case': {
      return generatePayloadFromCase(accum, { message, messageId });
    }
    default: {
      return assertExhaustive(type);
    }
  }
};

const messagesToPayloadsByIndex = (messages: MessageWithMeta[]): PayloadsByIndex =>
  messages.reduce(messagesToPayloadReducer, {});

export const messagesToPayloadsByAccountSid = (
  messages: MessagesByAccountSid,
): PayloadsByAccountSid => {
  const payloadsByAccountSidEntries = Object.entries(messages).map(([accountSid, ms]) => {
    const payloads = messagesToPayloadsByIndex(ms);

    return [accountSid, payloads] as const;
  });

  const payloadsByAccountSid = Object.fromEntries(payloadsByAccountSidEntries);

  return payloadsByAccountSid;
};
