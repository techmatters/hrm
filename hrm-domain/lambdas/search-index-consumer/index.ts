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

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };
  console.debug('Received event:', JSON.stringify(event, null, 2));
  // We need to keep track of the documentId to messageId mapping so we can
  // return the correct messageId in the batchItemFailures array on error.
  const documentIdToMessageId: Record<string, string> = {};

  // Passthrough function to add the documentId to the messageId mapping.
  const addDocumentIdToMessageId = (documentId: string, messageId: string) => {
    documentIdToMessageId[documentId] = messageId;
  };

  // Passthrough function to add the documentId to the batchItemFailures array.
  // const addDocumentIdToFailures = (documentId: string) =>
  //   response.batchItemFailures.push({
  //     itemIdentifier: documentIdToMessageId[documentId],
  //   });

  try {
    // Map the messages and add the documentId to messageId mapping.
    // const messages = mapMessages(event.Records, addDocumentIdToMessageId);
    const messages = event.Records.map((record: SQSRecord) => {
      const { messageId, body } = record;
      const message = JSON.parse(body);
      addDocumentIdToMessageId(message.document.id, messageId);

      return message;
    });
    console.debug('Mapped messages:', JSON.stringify(messages, null, 2));

    console.debug(`Successfully indexed documents`);
  } catch (err) {
    console.error(new Error('Failed to process search index request'), err);

    response.batchItemFailures = event.Records.map(record => {
      return {
        itemIdentifier: record.messageId,
      };
    });
  }

  return response;
};
