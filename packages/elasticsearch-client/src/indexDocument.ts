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
import { IndexResponse } from '@elastic/elasticsearch/lib/api/types';
import { PassThroughConfig } from './client';
import createIndex from './createIndex';
import { newErr, newOk, TResult } from '@tech-matters/types';

export type IndexDocumentExtraParams<T> = {
  id: string;
  document: T;
  autocreate?: boolean;
};

export type IndexDocumentParams<T> = PassThroughConfig<T> & IndexDocumentExtraParams<T>;
export type IndexDocumentResponse = TResult<'IndexDocumentError', IndexResponse>;

export const indexDocument = async <T>({
  client,
  document,
  id,
  index,
  indexConfig,
  autocreate = false,
}: IndexDocumentParams<T>): Promise<IndexDocumentResponse> => {
  try {
    if (autocreate) {
      // const exists = await client.indices.exists({ index });
      // NOTE: above check is already performed in createIndex
      await createIndex({ client, index, indexConfig });
    }

    const convertedDocument = indexConfig.convertToIndexDocument(document, index);

    const response = await client.index({
      index,
      id,
      document: convertedDocument,
    });
    return newOk({ data: response });
  } catch (error) {
    return newErr({
      error: 'IndexDocumentError',
      message: error instanceof Error ? error.message : String(error),
      extraProperties: { ...(error as any)?.meta, originalError: error },
    });
  }
};

export default indexDocument;
