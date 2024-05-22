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

    console.debug(`Successfully indexed documents`);

    // filter the payloads that failed indexing
    const documentsWithErrors = resultsByAccount
      .flat(2)
      .filter(({ result }) => isErr(result));

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
