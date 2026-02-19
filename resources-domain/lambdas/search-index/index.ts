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
import { ResourceIndexProcessorError } from '@tech-matters/job-errors';
import {
  getClient,
  BulkOperations,
  ExecuteBulkResponse,
} from '@tech-matters/elasticsearch-client';
import type {
  FlatResource,
  ResourcesSearchIndexPayload,
} from '@tech-matters/resources-types';

import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import {
  RESOURCE_INDEX_TYPE,
  getResourceIndexConfiguration,
} from '@tech-matters/resources-search-config';
import { getSsmParameter } from '@tech-matters/ssm-cache';

export type DocumentsByAccountSid = Record<string, BulkOperations<FlatResource>>;

export const convertDocumentsToBulkRequest = (messages: ResourcesSearchIndexPayload[]) =>
  messages.reduce((acc, message) => {
    const { accountSid, document } = message;
    if (!acc[accountSid]) {
      acc[accountSid] = [];
    }
    if (document.deletedAt) {
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${document.id}): Deleting Document for resource.`,
        ``,
      );
      acc[accountSid].push({
        action: 'delete',
        id: document.id,
      });
    } else {
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${accountSid}/${document.id}): Indexing Document for resource.`,
        'Converted document:',
        document,
      );
      acc[accountSid].push({
        action: 'index',
        id: document.id,
        document,
      });
    }
    return acc;
  }, {} as DocumentsByAccountSid);

export const handleErrors = async (
  indexResp: ExecuteBulkResponse,
  addDocumentIdToFailures: any,
) => {
  await Promise.all(
    indexResp?.items.map(item => {
      // 201 for creating a new index document and 200 for updating an existing one
      if (![200, 201].includes(item.index?.status ?? 0)) {
        console.error(
          new ResourceIndexProcessorError('Error indexing document'),
          item.index ?? item.delete,
          item.index?.error ?? item.delete?.error,
        );
        addDocumentIdToFailures(item.index?._id ?? item.delete?._id ?? '');
      }
    }),
  );
};

export const executeBulk = async (
  documentsByAccountSid: DocumentsByAccountSid,
  addDocumentIdToFailures: any,
) => {
  await Promise.all(
    Object.keys(documentsByAccountSid).map(async accountSid => {
      const shortCode = await getSsmParameter(
        `/${process.env.NODE_ENV}/twilio/${accountSid}/short_helpline`,
      );
      const resourceIndexConfiguration = getResourceIndexConfiguration(shortCode);

      const documents = documentsByAccountSid[accountSid];
      const client = (
        await getClient({
          accountSid,
          indexType: RESOURCE_INDEX_TYPE,
          ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
        })
      ).indexClient(resourceIndexConfiguration);
      try {
        const indexResp = await client.executeBulk({ documents, autocreate: true });
        await handleErrors(indexResp, addDocumentIdToFailures);
      } catch (err) {
        console.error(new ResourceIndexProcessorError('Error calling executeBulk'), err);
        documents.forEach(({ id }) => {
          addDocumentIdToFailures(id);
        });
      }
    }),
  );
};

export const mapMessages = (
  records: SQSRecord[],
  addDocumentIdToMessageId: any,
): ResourcesSearchIndexPayload[] =>
  records.map((record: SQSRecord) => {
    const { messageId, body } = record;
    const message = JSON.parse(body) as ResourcesSearchIndexPayload;
    addDocumentIdToMessageId(message.document.id, messageId);

    return message;
  });

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };
  console.debug(
    `Received resource index request with ${event.Records.length} records`,
    JSON.stringify(event, null, 2),
  );
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
  let fullyQualifiedResources = ['not determined'];
  try {
    // Map the messages and add the documentId to messageId mapping.
    const messages = mapMessages(event.Records, addDocumentIdToMessageId);
    fullyQualifiedResources = messages.map(m => `${m.accountSid}/${m.document.id}`);
    fullyQualifiedResources.forEach(fqr =>
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${fqr}): Mapped messages for resources.`,
      ),
    );

    // Convert the messages to a bulk requests grouped by accountSid.
    const documentsByAccountSid = convertDocumentsToBulkRequest(messages);
    fullyQualifiedResources.forEach(fqr =>
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${fqr}): Converted document to bulk request.`,
      ),
    );

    // Iterates over groups of documents and index them using an accountSid specific client
    await executeBulk(documentsByAccountSid, addDocumentIdToFailures);
    fullyQualifiedResources.forEach(fqr =>
      console.debug(
        `[Imported Resource Trace](qualifiedResourceId:${fqr}): Successfully indexed document.`,
      ),
    );
  } catch (err) {
    fullyQualifiedResources.forEach(fqr =>
      console.error(
        `[Imported Resource Trace](qualifiedResourceId:${fqr}): Error indexing document.`,
        new ResourceIndexProcessorError('Failed to process search index request'),
        err,
      ),
    );

    response.batchItemFailures = event.Records.map(record => {
      return {
        itemIdentifier: record.messageId,
      };
    });
  }

  return response;
};
