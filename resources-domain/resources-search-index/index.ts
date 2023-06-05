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
import { ResourcesJobProcessorError } from '@tech-matters/job-errors';
import { getClient, IndexDocumentBulkDocuments, IndexDocumentBulkResponse } from '@tech-matters/elasticsearch-client';
import { FlatResource, ResourcesSearchIndexPayload } from '@tech-matters/types';

// eslint-disable-next-line prettier/prettier
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { RESOURCE_INDEX_TYPE, resourceIndexConfiguration } from '@tech-matters/resources-search-config';

export type DocumentsByAccountSid = Record<string, IndexDocumentBulkDocuments<FlatResource>>;

export const convertDocumentsToBulkRequest = (messages: ResourcesSearchIndexPayload[] ) => messages.reduce((acc, message) => {
    const { accountSid, document } = message;
    if (!acc[accountSid]) {
      acc[accountSid] = [];
    }
    acc[accountSid].push({
      id: document.id,
      document,
    });
    return acc;
  }, {} as DocumentsByAccountSid);

export const handleErrors = async (indexResp: IndexDocumentBulkResponse, addDocumentIdToFailures: any) => {
  await Promise.all(indexResp?.items.map((item) => {
    // 201 for creating a new index document and 200 for updating an existing one
    if ([200, 201].includes(item.index?.status ?? 0)) {
      console.error(new ResourcesJobProcessorError('Error indexing document'), item.index);
      addDocumentIdToFailures(item.index!._id!);
    }
  }));
};

export const indexDocumentsBulk = async (documentsByAccountSid: DocumentsByAccountSid, addDocumentIdToFailures: any) => {
  await Promise.all(Object.keys(documentsByAccountSid).map(async (accountSid) => {
    const documents = documentsByAccountSid[accountSid];
    const client = (await getClient({ accountSid, indexType: RESOURCE_INDEX_TYPE })).indexClient(resourceIndexConfiguration);
    try {
      const indexResp = await client.indexDocumentBulk({ documents });
      await handleErrors(indexResp, addDocumentIdToFailures);
    } catch (err) {
      console.error(new ResourcesJobProcessorError('Error calling indexDocumentBulk'), err);
      documents.forEach(({ id }) => {
        addDocumentIdToFailures(id);
      });
    }
  }));
};

export const mapMessages = (records: SQSRecord[], addDocumentIdToMessageId: any): ResourcesSearchIndexPayload[] =>
  records.map((record: SQSRecord) => {
    const { messageId, body } = record;
    const message = JSON.parse(body) as ResourcesSearchIndexPayload;
    addDocumentIdToMessageId(message.document.id, messageId);

    return message;
  });

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
  const addDocumentIdToFailures = (documentId: string) =>
    response.batchItemFailures.push({
      itemIdentifier: documentIdToMessageId[documentId],
    });

  try {
    // Map the messages and add the documentId to messageId mapping.
    const messages = mapMessages(event.Records, addDocumentIdToMessageId);
    console.debug('Mapped messages:', JSON.stringify(messages, null, 2));

    // Convert the messages to a bulk requests grouped by accountSid.
    const documentsByAccountSid = convertDocumentsToBulkRequest(messages);
    console.debug('Converted documents to bulk request:', JSON.stringify(documentsByAccountSid, null, 2));

    // Iterates over groups of documents and index them using an accountSid specific client
    await indexDocumentsBulk(documentsByAccountSid, addDocumentIdToFailures);
    console.debug(`Successfully indexed documents`);
  } catch (err) {
    console.error(new ResourcesJobProcessorError('Failed to process search index request'), err);

    response.batchItemFailures = event.Records.map(record => {
      return {
        itemIdentifier: record.messageId,
      };
    });
  }

  return response;
};
