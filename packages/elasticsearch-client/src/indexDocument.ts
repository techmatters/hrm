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
import { ErrorResult, isErr, newErr, newOk, Result } from '@tech-matters/types';

export type IndexDocumentExtraParams<T> = {
  id: string;
  document: T;
  autocreate?: boolean;
};

export type IndexDocumentParams<T> = PassThroughConfig<T> & IndexDocumentExtraParams<T>;
type IndexDocumentError = 'IndexDocumentError' | 'CreateIndexConvertedDocumentError';
export type IndexDocumentResponse = Result<
  ErrorResult<IndexDocumentError>,
  IndexResponse
>;

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

    const convertedDocumentResult = indexConfig.convertToIndexDocument(document, index);

    if (isErr(convertedDocumentResult)) {
      return convertedDocumentResult;
    }

    const response = await client.index({
      index,
      id,
      document: convertedDocumentResult.data,
    });

    return newOk({ data: response });
  } catch (err) {
    return newErr({
      error: 'IndexDocumentError',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export default indexDocument;
