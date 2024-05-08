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
import { getClient } from '@tech-matters/elasticsearch-client';
// import { GetSignedUrlMethods, GET_SIGNED_URL_METHODS } from '@tech-matters/s3-client';
import { HrmIndexProcessorError } from '@tech-matters/job-errors';
import {
  IndexMessage,
  HRM_CASES_CONTACTS_INDEX_TYPE,
  hrmIndexConfiguration,
  IndexPayload,
  getDocumentId,
  getContactParentId,
} from '@tech-matters/hrm-search-config';
import {
  AccountSID,
  assertExhaustive,
  isErr,
  newErr,
  newOkFromData,
} from '@tech-matters/types';

export type MessagesByAccountSid = Record<
  AccountSID,
  { message: IndexMessage; documentId: string; messageId: string }[]
>;
type PayloadWithMeta = {
  payload: IndexPayload;
  documentId: string;
  messageId: string;
  routing?: string;
};
type PayloadsByIndex = {
  [indexType: string]: PayloadWithMeta[];
};
export type PayloadsByAccountSid = Record<AccountSID, PayloadsByIndex>;

type MessagesByDocumentId = {
  [documentId: string]: {
    documentId: string;
    messageId: string;
    message: IndexMessage;
  };
};

const reduceByDocumentId = (
  accum: MessagesByDocumentId,
  curr: SQSRecord,
): MessagesByDocumentId => {
  const { messageId, body } = curr;
  const message = JSON.parse(body) as IndexMessage;

  const documentId = getDocumentId(message);

  return { ...accum, [documentId]: { documentId, messageId, message } };
};

const groupMessagesByAccountSid = (
  accum: MessagesByAccountSid,
  curr: {
    documentId: string;
    messageId: string;
    message: IndexMessage;
  },
): MessagesByAccountSid => {
  const { message } = curr;
  const { accountSid } = message;

  if (!accum[accountSid]) {
    return { ...accum, [accountSid]: [curr] };
  }

  return { ...accum, [accountSid]: [...accum[accountSid], curr] };
};

const messagesToPayloadsByIndex = (
  accum: PayloadsByIndex,
  currM: {
    documentId: string;
    messageId: string;
    message: IndexMessage;
  },
): PayloadsByIndex => {
  const { message } = currM;

  const { type } = message;

  switch (type) {
    case 'contact': {
      // TODO: Pull the transcripts from S3 (if any)
      return {
        ...accum,
        [HRM_CASES_CONTACTS_INDEX_TYPE]: [
          ...(accum[HRM_CASES_CONTACTS_INDEX_TYPE] ?? []),
          {
            ...currM,
            payload: { ...message, transcript: '' },
            routing: getContactParentId(
              HRM_CASES_CONTACTS_INDEX_TYPE,
              message.contact.caseId,
            ),
          },
        ],
      };
    }
    case 'case': {
      return {
        ...accum,
        [HRM_CASES_CONTACTS_INDEX_TYPE]: [
          ...(accum[HRM_CASES_CONTACTS_INDEX_TYPE] ?? []),
          { ...currM, payload: { ...message } },
        ],
      };
    }
    default: {
      return assertExhaustive(type);
    }
  }
};

const indexDocumentsByIndex =
  (accountSid: string) =>
  async ([indexType, payloads]: [string, PayloadWithMeta[]]) => {
    // get the client for the accountSid-indexType pair
    const client = (await getClient({ accountSid, indexType })).indexClient(
      hrmIndexConfiguration,
    );

    const indexed = await Promise.all(
      payloads.map(({ documentId, messageId, payload, routing }) =>
        client
          .indexDocument({
            id: documentId,
            document: payload,
            autocreate: true,
            routing,
          })
          .then(result => ({
            accountSid,
            indexType,
            documentId,
            messageId,
            result: newOkFromData(result),
          }))
          .catch(err => {
            console.error(
              new HrmIndexProcessorError('Failed to process search index request'),
              err,
            );

            return {
              accountSid,
              indexType,
              documentId,
              messageId,
              result: newErr({
                error: 'ErrorFailedToInex',
                message: err instanceof Error ? err.message : String(err),
              }),
            };
          }),
      ),
    );

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
    // link each composite "documentId" to it's corresponding "messageId"
    const documentIdToMessage = event.Records.reduce(reduceByDocumentId, {});

    // group the messages by accountSid
    const messagesByAccoundSid = Object.values(
      documentIdToMessage,
    ).reduce<MessagesByAccountSid>(groupMessagesByAccountSid, {});

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
