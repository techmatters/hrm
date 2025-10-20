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
  type DeleteContactMessage,
  type IndexCaseMessage,
  type DeleteCaseMessage,
} from '@tech-matters/hrm-search-config';
import { type HrmAccountId } from '@tech-matters/types';
import { ExportTranscriptDocument, isS3StoredTranscript } from '@tech-matters/hrm-types';
import type { MessageWithMeta, MessagesByAccountSid } from './messages';
import { getSsmParameter, SsmParameterNotFound } from '@tech-matters/ssm-cache';

/**
 * A payload is single object that should be indexed in a particular index. A single message might represent multiple payloads.
 * The indexHandler represents the operation that should be used when indexing the given document:
 *   - indexDocument: Used when we don't care overriding the previous versions of the document. An example is when a document is created for the first time
 *   - updateDocument: Used when we want to preserve the existing document (if any), using the document object for the update. An example is update a case
 *   - updateScript: Used when we want to preserve the existing document (if any), using the generated "update script" for the update. An example is updating case.contacts list when a contact is indexed
 */
export type PayloadWithMeta =
  | {
      documentId: number;
      payload: IndexPayload;
      messageId: string;
      indexHandler: 'indexDocument' | 'updateDocument' | 'updateScript';
    }
  | {
      documentId: number;
      messageId: string;
      indexHandler: 'deleteDocument';
    };
export type PayloadsByIndex = {
  [indexType: string]: PayloadWithMeta[];
};
export type PayloadsByAccountSid = Record<HrmAccountId, PayloadsByIndex>;

/**
 * ContactIndexingInputData type represents an "index contact" message, plus contact specific data that might be collected from other places other than the HRM DB (e.g. transcripts fetched from S3)
 */
type ContactIndexingInputData = MessageWithMeta & {
  message: IndexContactMessage | DeleteContactMessage;
} & {
  transcript: string | null;
};

const shouldIndexTranscripts = async (accountSid: HrmAccountId): Promise<boolean> => {
  try {
    const indexTranscriptParameterValue = await getSsmParameter(
      `/${process.env.NODE_ENV}/hrm/${accountSid}/index_transcripts_for_search`,
    );
    if (indexTranscriptParameterValue?.toLowerCase() === 'false') {
      return false;
    }
  } catch (e) {
    // Default when SSM parameter not present is true, continue
    if (!e instanceof SsmParameterNotFound) {
      throw e;
    }
  }
  return true;
};

const contactIndexingInputData = async (
  m: MessageWithMeta & {
    message: IndexContactMessage;
  },
): Promise<ContactIndexingInputData> => {
  let transcript: string | null = null;
  try {
    const transcriptEntry =
      m.message.contact.conversationMedia?.find(isS3StoredTranscript);

    if (transcriptEntry && (await shouldIndexTranscripts(message.accountSid))) {
      const { location } = transcriptEntry.storeTypeSpecificData;
      const { bucket, key } = location || {};
      if (bucket && key) {
        const transcriptString = await getS3Object({ bucket, key });
        const parsedTranscript: ExportTranscriptDocument = JSON.parse(transcriptString);
        transcript = parsedTranscript.transcript.messages
          .map(({ body }) => body)
          .join('\n');
      }
    }
  } catch (err) {
    console.error(
      `Error trying to fetch transcript for contact #${m.message.contact.id}`,
      err,
    );
  }

  return { ...m, transcript };
};

/**
 * CaseIndexingInputData type represents an "index case" message, plus case specific data that might be collected from other places other than the HRM DB (no instances of such data right now, defining the type for completeness)
 */
type CaseIndexingInputData = MessageWithMeta & {
  message: IndexCaseMessage | DeleteCaseMessage;
};

const caseIndexingInputData = async (
  m: MessageWithMeta & {
    message: IndexCaseMessage;
  },
): Promise<CaseIndexingInputData> => m;

type IndexingInputData = ContactIndexingInputData | CaseIndexingInputData;
const indexingInputDataMapper = async (
  m: MessageWithMeta,
): Promise<IndexingInputData> => {
  const { message, messageId } = m;
  if (message.operation === 'delete') {
    switch (message.entityType) {
      case 'contact': {
        return { message, messageId } as ContactIndexingInputData;
      }
      case 'case': {
        return { message, messageId } as CaseIndexingInputData;
      }
    }
  }

  switch (message.entityType) {
    case 'contact': {
      return contactIndexingInputData({ message, messageId });
    }
    case 'case': {
      return caseIndexingInputData({ message, messageId });
    }
  }
};

const generatePayloadFromContact = (
  ps: PayloadsByIndex,
  m: ContactIndexingInputData,
): PayloadsByIndex => {
  switch (m.message.operation) {
    case 'create':
    case 'update':
    case 'reindex': {
      return {
        ...ps,
        // add an upsert job to HRM_CONTACTS_INDEX_TYPE index
        [HRM_CONTACTS_INDEX_TYPE]: [
          ...(ps[HRM_CONTACTS_INDEX_TYPE] ?? []),
          {
            ...m,
            documentId: parseInt(m.message.contact.id),
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
                documentId: parseInt(m.message.contact.caseId),
                payload: { ...m.message, transcript: m.transcript },
                indexHandler: 'updateScript',
              },
            ]
          : ps[HRM_CASES_INDEX_TYPE] ?? [],
      };
    }
    case 'delete': {
      // Compatibility with old messages that don't have a message.id field, can be removed once HRM v1.26.0 is deployed
      const contactId = m.message.id ?? (m.message as any).contact?.id;
      return {
        ...ps,
        // add a delete job to HRM_CASES_INDEX_TYPE index
        [HRM_CONTACTS_INDEX_TYPE]: [
          ...(ps[HRM_CONTACTS_INDEX_TYPE] ?? []),
          {
            ...m,
            documentId: parseInt(contactId),
            indexHandler: 'deleteDocument',
          },
        ],
      };
    }
  }
};

const generatePayloadFromCase = (
  ps: PayloadsByIndex,
  m: CaseIndexingInputData,
): PayloadsByIndex => {
  switch (m.message.operation) {
    case 'create':
    case 'update':
    case 'reindex': {
      return {
        ...ps,
        // add an upsert job to HRM_CASES_INDEX_TYPE index
        [HRM_CASES_INDEX_TYPE]: [
          ...(ps[HRM_CASES_INDEX_TYPE] ?? []),
          {
            ...m,
            documentId: parseInt(m.message.case.id),
            payload: { ...m.message },
            indexHandler: 'updateDocument',
          },
        ],
      };
    }
    case 'delete': {
      // Compatibility with old messages that don't have a message.id field, can be removed once HRM v1.26.0 is deployed
      const caseId = m.message.id ?? (m.message as any).case?.id;
      if (!caseId) {
        throw new Error(`Case id not found in message ${m}`);
      }
      return {
        ...ps,
        // add a delete job to HRM_CASES_INDEX_TYPE index
        [HRM_CASES_INDEX_TYPE]: [
          ...(ps[HRM_CASES_INDEX_TYPE] ?? []),
          {
            ...m,
            documentId: parseInt(caseId),
            indexHandler: 'deleteDocument',
          },
        ],
      };
    }
  }
};

const messagesToPayloadReducer = (
  accum: PayloadsByIndex,
  currM: IndexingInputData,
): PayloadsByIndex => {
  const { message, messageId } = currM;

  switch (message.entityType) {
    case 'contact': {
      const { transcript } = currM as ContactIndexingInputData;
      return generatePayloadFromContact(accum, { message, messageId, transcript });
    }
    case 'case': {
      return generatePayloadFromCase(accum, { message, messageId });
    }
  }
};

const messagesToPayloadsByIndex = async (
  messages: MessageWithMeta[],
): Promise<PayloadsByIndex> => {
  const indexingInputData = await Promise.all(messages.map(indexingInputDataMapper));

  return (indexingInputData.filter(Boolean) as IndexingInputData[]).reduce(
    messagesToPayloadReducer,
    {},
  );
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

  return Object.fromEntries(payloadsByAccountSidEntries);
};
