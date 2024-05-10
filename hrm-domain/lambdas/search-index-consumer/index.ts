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
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { getClient, IndexClient } from '@tech-matters/elasticsearch-client';
// import { GetSignedUrlMethods, GET_SIGNED_URL_METHODS } from '@tech-matters/s3-client';
import { HrmIndexProcessorError } from '@tech-matters/job-errors';
import {
  HRM_CASES_INDEX_TYPE,
  HRM_CONTACTS_INDEX_TYPE,
  hrmIndexConfiguration,
  IndexMessage,
  IndexPayload,
} from '@tech-matters/hrm-search-config';
import {
  AccountSID,
  assertExhaustive,
  isErr,
  newErr,
  newOkFromData,
} from '@tech-matters/types';

type MessageWithMeta = { message: IndexMessage; messageId: string };
type MessagesByAccountSid = Record<AccountSID, MessageWithMeta[]>;
type PayloadWithMeta = {
  documentId: number;
  payload: IndexPayload;
  messageId: string;
  indexHandler: 'indexDocument' | 'updateDocument' | 'updateScript';
};
type PayloadsByIndex = {
  [indexType: string]: PayloadWithMeta[];
};
type PayloadsByAccountSid = Record<AccountSID, PayloadsByIndex>;

const groupMessagesByAccountSid = (
  accum: MessagesByAccountSid,
  curr: SQSRecord,
): MessagesByAccountSid => {
  const { messageId, body } = curr;
  const message = JSON.parse(body) as IndexMessage;

  const { accountSid } = message;

  if (!accum[accountSid]) {
    return { ...accum, [accountSid]: [{ messageId, message }] };
  }

  return { ...accum, [accountSid]: [...accum[accountSid], { messageId, message }] };
};

const messagesToPayloadsByIndex = (
  accum: PayloadsByIndex,
  currM: MessageWithMeta,
): PayloadsByIndex => {
  const { message } = currM;

  const { type } = message;

  switch (type) {
    case 'contact': {
      // TODO: Pull the transcripts from S3 (if any)
      return {
        ...accum,
        // add an upsert job to HRM_CONTACTS_INDEX_TYPE index
        [HRM_CONTACTS_INDEX_TYPE]: [
          ...(accum[HRM_CONTACTS_INDEX_TYPE] ?? []),
          {
            ...currM,
            documentId: message.contact.id,
            payload: { ...message, transcript: '' },
            indexHandler: 'updateDocument',
          },
        ],
        // if associated to a case, add an upsert with script job to HRM_CASES_INDEX_TYPE index
        [HRM_CASES_INDEX_TYPE]: message.contact.caseId
          ? [
              ...(accum[HRM_CASES_INDEX_TYPE] ?? []),
              {
                ...currM,
                documentId: parseInt(message.contact.caseId, 10),
                payload: { ...message, transcript: '' },
                indexHandler: 'updateScript',
              },
            ]
          : accum[HRM_CASES_INDEX_TYPE] ?? [],
      };
    }
    case 'case': {
      return {
        ...accum,
        // add an upsert job to HRM_CASES_INDEX_TYPE index
        [HRM_CASES_INDEX_TYPE]: [
          ...(accum[HRM_CASES_INDEX_TYPE] ?? []),
          {
            ...currM,
            documentId: message.case.id,
            payload: { ...message },
            indexHandler: 'updateDocument',
          },
        ],
      };
    }
    default: {
      return assertExhaustive(type);
    }
  }
};

const handleIndexPayload =
  ({
    accountSid,
    client,
    indexType,
  }: {
    accountSid: string;
    client: IndexClient<IndexPayload>;
    indexType: string;
  }) =>
  async ({ documentId, indexHandler, messageId, payload }: PayloadWithMeta) => {
    try {
      switch (indexHandler) {
        case 'indexDocument': {
          const result = await client.indexDocument({
            id: documentId.toString(),
            document: payload,
            autocreate: true,
          });

          return {
            accountSid,
            indexType,
            messageId,
            result: newOkFromData(result),
          };
        }
        case 'updateDocument': {
          const result = await client.updateDocument({
            id: documentId.toString(),
            document: payload,
            autocreate: true,
            docAsUpsert: true,
          });

          return {
            accountSid,
            indexType,
            messageId,
            result: newOkFromData(result),
          };
        }
        case 'updateScript': {
          const result = await client.updateScript({
            document: payload,
            id: documentId.toString(),
            autocreate: true,
            scriptedUpsert: true,
          });

          return {
            accountSid,
            indexType,
            messageId,
            result: newOkFromData(result),
          };
        }
        default: {
          return assertExhaustive(indexHandler);
        }
      }
    } catch (err) {
      console.error(
        new HrmIndexProcessorError('handleIndexPayload: Failed to process index request'),
        err,
      );

      return {
        accountSid,
        indexType,
        messageId,
        result: newErr({
          error: 'ErrorFailedToInex',
          message: err instanceof Error ? err.message : String(err),
        }),
      };
    }
  };

const indexDocumentsByIndex =
  (accountSid: string) =>
  async ([indexType, payloads]: [string, PayloadWithMeta[]]) => {
    // get the client for the accountSid-indexType pair
    const client = (await getClient({ accountSid, indexType })).indexClient(
      hrmIndexConfiguration,
    );

    const mapper = handleIndexPayload({ client, accountSid, indexType });

    const indexed = await Promise.all(payloads.map(mapper));

    return indexed;
  };

const indexDocumentsByAccount = async ([accountSid, payloadsByIndex]: [
  string,
  PayloadsByIndex,
]) => {
  const resultsByIndex = await Promise.all(
    Object.entries(payloadsByIndex).map(indexDocumentsByIndex(accountSid)),
  );

  return resultsByIndex;
};

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.debug('Received event:', JSON.stringify(event, null, 2));

  try {
    // group the messages by accountSid while adding message meta
    const messagesByAccoundSid = event.Records.reduce<MessagesByAccountSid>(
      groupMessagesByAccountSid,
      {},
    );

    // generate corresponding IndexPayload for each IndexMessage and group them by target indexType
    const documentsByAccountSid: PayloadsByAccountSid = Object.fromEntries(
      Object.entries(messagesByAccoundSid).map(([accountSid, messages]) => {
        const payloads = messages.reduce(messagesToPayloadsByIndex, {});

        return [accountSid, payloads] as const;
      }),
    );

    console.debug('Mapped messages:', JSON.stringify(documentsByAccountSid, null, 2));

    const resultsByAccount = await Promise.all(
      Object.entries(documentsByAccountSid).map(indexDocumentsByAccount),
    );

    console.debug(`Successfully indexed documents`);

    const documentsWithErrors = resultsByAccount
      .flat(2)
      .filter(({ result }) => isErr(result));

    if (documentsWithErrors.length) {
      console.debug(
        'Errors indexing documents',
        JSON.stringify(documentsWithErrors, null, 2),
      );
    }

    const response: SQSBatchResponse = {
      batchItemFailures: documentsWithErrors.map(({ messageId }) => ({
        itemIdentifier: messageId,
      })),
    };

    return response;
  } catch (err) {
    console.error(
      new HrmIndexProcessorError('Failed to process search index request'),
      err,
    );

    const response: SQSBatchResponse = {
      batchItemFailures: event.Records.map(record => {
        return {
          itemIdentifier: record.messageId,
        };
      }),
    };

    return response;
  }
};
