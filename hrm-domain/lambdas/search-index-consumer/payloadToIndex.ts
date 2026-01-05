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

import { type IndexClient, getClient } from '@tech-matters/elasticsearch-client';
import {
  type IndexPayload,
  hrmIndexConfiguration,
} from '@tech-matters/hrm-search-config';
import type {
  PayloadWithMeta,
  PayloadsByAccountSid,
  PayloadsByIndex,
} from './messagesToPayloads';
import { type HrmAccountId, newErr, newOkFromData, isErr } from '@tech-matters/types';
import { HrmIndexProcessorError } from '@tech-matters/job-errors';

const handleIndexPayload =
  ({
    accountSid,
    client,
    indexType,
  }: {
    accountSid: HrmAccountId;
    client: IndexClient<IndexPayload>;
    indexType: string;
  }) =>
  async (payloadWithMeta: PayloadWithMeta) => {
    const { messageId, documentId } = payloadWithMeta;
    try {
      switch (payloadWithMeta.indexHandler) {
        case 'indexDocument': {
          const result = await client.indexDocument({
            id: documentId.toString(),
            document: payloadWithMeta.payload,
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
            document: payloadWithMeta.payload,
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
            document: payloadWithMeta.payload,
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
        case 'deleteDocument': {
          const result = await client.deleteDocument({
            id: documentId.toString(),
          });

          console.log('>>>>>>>> delete document result', JSON.stringify(result, null, 2));

          if (isErr(result)) {
            // bubble error if it's different from "not found", ignore otherwise
            if (result.extraProperties?.meta?.statusCode !== 404) {
              result.unwrap();
            }
          }

          return {
            accountSid,
            indexType,
            messageId,
            result: newOkFromData(result),
          };
        }
      }
    } catch (err) {
      console.error(
        new HrmIndexProcessorError('handleIndexPayload: Failed to process index request'),
        err,
        payloadWithMeta,
      );

      return {
        accountSid,
        indexType,
        messageId,
        result: newErr({
          error: 'ErrorFailedToIndex',
          message: err instanceof Error ? err.message : String(err),
        }),
      };
    }
  };

const indexDocumentsByIndexMapper =
  (accountSid: HrmAccountId) =>
  async ([indexType, payloads]: [string, PayloadWithMeta[]]) => {
    if (!process.env.SSM_PARAM_ELASTICSEARCH_CONFIG) {
      throw new Error('SSM_PARAM_ELASTICSEARCH_CONFIG missing in environment variables');
    }

    // get the client for the accountSid-indexType pair
    const client = (
      await getClient({
        accountSid,
        indexType,
        ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
      })
    ).indexClient(hrmIndexConfiguration);

    const mapper = handleIndexPayload({ client, accountSid, indexType });

    const indexed = await Promise.all(payloads.map(mapper));

    return indexed;
  };

const indexDocumentsByAccountMapper = async ([accountSid, payloadsByIndex]: [
  HrmAccountId,
  PayloadsByIndex,
]) => {
  const resultsByIndex = await Promise.all(
    Object.entries(payloadsByIndex).map(indexDocumentsByIndexMapper(accountSid)),
  );

  return resultsByIndex;
};

export const indexDocumentsByAccount = async (
  payloadsByAccountSid: PayloadsByAccountSid,
) =>
  Promise.all(
    (Object.entries(payloadsByAccountSid) as [HrmAccountId, PayloadsByIndex][]).map(
      indexDocumentsByAccountMapper,
    ),
  );
