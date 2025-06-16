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
import { UpdateResponse } from '@elastic/elasticsearch/lib/api/types';
import { PassThroughConfig } from './client';
import createIndex from './createIndex';
import { ErrorResult, isErr, newErr, newOk, Result } from '@tech-matters/types';

type UpdateParams<T> = { id: string; document: T; autocreate?: boolean };

export type UpdateDocumentExtraParams<T> = UpdateParams<T> & {
  docAsUpsert?: boolean;
};

export type UpdateDocumentParams<T> = PassThroughConfig<T> & UpdateDocumentExtraParams<T>;
type UpdateDocumentError = 'UpdateDocumentError' | 'CreateIndexConvertedDocumentError';
export type UpdateDocumentResponse = Result<
  ErrorResult<UpdateDocumentError>,
  UpdateResponse
>;

export const updateDocument = async <T>({
  client,
  document,
  id,
  index,
  indexConfig,
  docAsUpsert = false,
  autocreate = false,
}: UpdateDocumentParams<T>): Promise<UpdateDocumentResponse> => {
  try {
    if (docAsUpsert && autocreate) {
      // const exists = await client.indices.exists({ index });
      // NOTE: above check is already performed in createIndex
      await createIndex({ client, index, indexConfig });
    }

    const convertedDocumentResult = indexConfig.convertToIndexDocument(document, index);

    if (isErr(convertedDocumentResult)) {
      return convertedDocumentResult;
    }

    const response = await client.update({
      index,
      id,
      doc: convertedDocumentResult.data,
      doc_as_upsert: docAsUpsert,
    });

    return newOk({ data: response });
  } catch (err) {
    return newErr({
      error: 'UpdateDocumentError',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export type UpdateScriptExtraParams<T> = UpdateParams<T> & { scriptedUpsert?: boolean };
export type UpdateScriptParams<T> = PassThroughConfig<T> & UpdateScriptExtraParams<T>;

export const updateScript = async <T>({
  client,
  document,
  id,
  index,
  indexConfig,
  scriptedUpsert = false,
  autocreate = false,
}: UpdateScriptParams<T>): Promise<UpdateDocumentResponse> => {
  try {
    if (!indexConfig.convertToScriptUpdate) {
      return newErr({
        error: 'UpdateDocumentError',
        message: `updateScript error: convertToScriptDocument not provided`,
      });
    }

    if (scriptedUpsert && autocreate) {
      // const exists = await client.indices.exists({ index });
      // NOTE: above check is already performed in createIndex
      await createIndex({ client, index, indexConfig });
    }

    const convertScriptResult = indexConfig.convertToScriptUpdate(document, index);
    if (isErr(convertScriptResult)) {
      return convertScriptResult;
    }

    const { documentUpdate, scriptUpdate } = convertScriptResult.data;

    const response = await client.update({
      index,
      id,
      script: scriptUpdate,
      upsert: documentUpdate,
      scripted_upsert: scriptedUpsert,
    });

    return newOk({ data: response });
  } catch (err) {
    return newErr({
      error: 'UpdateDocumentError',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
