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
import { getS3Object } from '@tech-matters/s3-client';
import {
  HRM_CASES_INDEX_TYPE,
  HRM_CONTACTS_INDEX_TYPE,
  type IndexPayload,
  type IndexContactMessage,
  type IndexCaseMessage,
} from '@tech-matters/hrm-search-config';
import { assertExhaustive, type AccountSID } from '@tech-matters/types';
import { isChatChannel, isS3StoredTranscript } from '@tech-matters/hrm-types';
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

type IntermidiateIndexContactMessage = MessageWithMeta & {
  message: IndexContactMessage;
} & {
  transcript: string | null;
};

const intermediateContactMessage = async (
  m: MessageWithMeta & {
    message: IndexContactMessage;
  },
): Promise<IntermidiateIndexContactMessage> => {
  let transcript: string | null = null;

  if (m.message.contact.channel && isChatChannel(m.message.contact.channel)) {
    const transcriptEntry =
      m.message.contact.conversationMedia?.find(isS3StoredTranscript);

    console.log('>>>>>>>> transcriptEntry', transcriptEntry);

    if (transcriptEntry) {
      const { location } = transcriptEntry.storeTypeSpecificData;
      const { bucket, key } = location || {};
      if (bucket && key) {
        transcript = await getS3Object({ bucket, key });
        console.log('>>>>>>>> transcript', transcript);
      }
    }
  }

  return { ...m, transcript };
};

type IntermidiateIndexCaseMessage = MessageWithMeta & {
  message: IndexCaseMessage;
};
const intermediateCaseMessage = async (
  m: MessageWithMeta & {
    message: IndexCaseMessage;
  },
): Promise<IntermidiateIndexCaseMessage> => m;

type IntermidiateIndexMessage =
  | IntermidiateIndexContactMessage
  | IntermidiateIndexCaseMessage;
const intermediateMessagesMapper = (
  m: MessageWithMeta,
): Promise<IntermidiateIndexMessage> => {
  const { message, messageId } = m;

  const { type } = message;

  switch (type) {
    case 'contact': {
      return intermediateContactMessage({ message, messageId });
    }
    case 'case': {
      return intermediateCaseMessage({ message, messageId });
    }
    default: {
      return assertExhaustive(type);
    }
  }
};

const generatePayloadFromContact = (
  ps: PayloadsByIndex,
  m: IntermidiateIndexContactMessage,
): PayloadsByIndex => {
  return {
    ...ps,
    // add an upsert job to HRM_CONTACTS_INDEX_TYPE index
    [HRM_CONTACTS_INDEX_TYPE]: [
      ...(ps[HRM_CONTACTS_INDEX_TYPE] ?? []),
      {
        ...m,
        documentId: m.message.contact.id,
        payload: { ...m.message, transcript: m.transcript },
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
            payload: { ...m.message, transcript: m.transcript },
            indexHandler: 'updateScript',
          },
        ]
      : ps[HRM_CASES_INDEX_TYPE] ?? [],
  };
};

const generatePayloadFromCase = (
  ps: PayloadsByIndex,
  m: IntermidiateIndexCaseMessage,
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
  currM: IntermidiateIndexMessage,
): PayloadsByIndex => {
  const { message, messageId } = currM;

  const { type } = message;

  switch (type) {
    case 'contact': {
      const { transcript } = currM as IntermidiateIndexContactMessage;
      return generatePayloadFromContact(accum, { message, messageId, transcript });
    }
    case 'case': {
      return generatePayloadFromCase(accum, { message, messageId });
    }
    default: {
      return assertExhaustive(type);
    }
  }
};

const messagesToPayloadsByIndex = async (
  messages: MessageWithMeta[],
): Promise<PayloadsByIndex> => {
  const intermidiateMessages = await Promise.all(
    messages.map(intermediateMessagesMapper),
  );

  return intermidiateMessages.reduce(messagesToPayloadReducer, {});
};

export const messagesToPayloadsByAccountSid = async (
  messages: MessagesByAccountSid,
): Promise<PayloadsByAccountSid> => {
  const payloadsByAccountSidEntries = await Promise.all(
    Object.entries(messages).map(async ([accountSid, ms]) => {
      const payloads = await messagesToPayloadsByIndex(ms);

      return [accountSid, payloads] as const;
    }),
  );

  const payloadsByAccountSid = Object.fromEntries(payloadsByAccountSidEntries);

  return payloadsByAccountSid;
};
