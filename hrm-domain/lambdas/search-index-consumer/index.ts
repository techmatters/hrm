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
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { HrmIndexProcessorError } from '@tech-matters/job-errors';
import { isErr } from '@tech-matters/types';
import { groupMessagesByAccountSid } from './messages';
import { messagesToPayloadsByAccountSid } from './messagesToPayloads';
import { indexDocumentsByAccount } from './payloadToIndex';

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.debug('Received event:', JSON.stringify(event, null, 2));

  try {
    // group the messages by accountSid while adding message meta
    const messagesByAccoundSid = groupMessagesByAccountSid(event.Records);

    // generate corresponding IndexPayload for each IndexMessage and group them by target accountSid-indexType pair
    const payloadsByAccountSid =
      await messagesToPayloadsByAccountSid(messagesByAccoundSid);

    console.debug('Mapped messages:', JSON.stringify(payloadsByAccountSid, null, 2));

    // index all the payloads
    const resultsByAccount = await indexDocumentsByAccount(payloadsByAccountSid);
    const documentsWithErrors: (typeof resultsByAccount)[number][number] = [];
    resultsByAccount.flat(2).forEach(resultItem => {
      const { result, indexType, accountSid, messageId } = resultItem;

      if (isErr(result)) {
        console.warn(
          `[generalised-search-${indexType}] ${result.error}. Account SID: ${accountSid}, Message ID: ${messageId}.`,
          result.message,
          result,
        );
        documentsWithErrors.push(resultItem);
        return;
      }

      const { message } =
        messagesByAccoundSid[accountSid].find(m => m.messageId === messageId) ?? {};
      if (!message) {
        console.warn(
          `[generalised-search-${indexType}]: Result Message ID not found. Account SID: ${accountSid}, Result has Message ID: ${messageId} but this ID was not found in the original input messages.`,
        );
        return;
      }
      switch (message.entityType) {
        case 'case': {
          if (message.operation === 'delete') {
            console.info(
              `[generalised-search-cases]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Case ID: ${message.id}. Operation: ${message.operation}. (key: ${accountSid}/${message.id}/${message.operation})`,
            );
            return;
          }
          const caseObj = message.case;
          console.info(
            `[generalised-search-cases]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Case ID: ${
              caseObj.id
            }, Updated / Created At: ${
              caseObj.updatedAt ?? caseObj.createdAt
            }. Operation: ${message.operation}. (key: ${accountSid}/${caseObj.id}/${
              caseObj.updatedAt ?? caseObj.createdAt
            }/${message.operation})`,
          );
          return;
        }
        case 'contact': {
          if (message.operation === 'delete') {
            console.info(
              `[generalised-search-contacts]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Contact ID: ${message.id}. Operation: ${message.operation}. (key: ${accountSid}/${message.id}/${message.operation})`,
            );
            return;
          }
          const { contact } = message;
          console.info(
            `[generalised-search-contacts]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Contact ID: ${
              contact.id
            }, Updated / Created At: ${
              contact.updatedAt ?? contact.createdAt
            }. Operation: ${message.operation}. (key: ${accountSid}/${contact.id}/${
              contact.updatedAt ?? contact.createdAt
            }/${message.operation})`,
          );
          return;
        }
      }
    });

    if (documentsWithErrors.length) {
      console.debug(
        'Errors indexing documents',
        JSON.stringify(documentsWithErrors, null, 2),
      );
    }

    // send the failed payloads back to SQS so they are redrive to DLQ
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
