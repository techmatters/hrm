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

type UpdateParams<T> = { id: string; document: T; autocreate?: boolean };

export type UpdateDocumentExtraParams<T> = UpdateParams<T> & {
  docAsUpsert?: boolean;
};

export type UpdateDocumentParams<T> = PassThroughConfig<T> & UpdateDocumentExtraParams<T>;
export type UpdateDocumentResponse = UpdateResponse;

export const updateDocument = async <T>({
  client,
  document,
  id,
  index,
  indexConfig,
  docAsUpsert = false,
  autocreate = false,
}: UpdateDocumentParams<T>): Promise<UpdateDocumentResponse> => {
  if (docAsUpsert && autocreate) {
    // const exists = await client.indices.exists({ index });
    // NOTE: above check is already performed in createIndex
    await createIndex({ client, index, indexConfig });
  }

  const documentUpdate = indexConfig.convertToIndexDocument(document, index);

  return client.update({
    index,
    id,
    doc: documentUpdate,
    doc_as_upsert: docAsUpsert,
  });
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
  if (!indexConfig.convertToScriptUpdate) {
    throw new Error(`updateScript error: convertToScriptDocument not provided`);
  }

  if (scriptedUpsert && autocreate) {
    // const exists = await client.indices.exists({ index });
    // NOTE: above check is already performed in createIndex
    await createIndex({ client, index, indexConfig });
  }

  const { documentUpdate, scriptUpdate } = indexConfig.convertToScriptUpdate(
    document,
    index,
  );

  return client.update({
    index,
    id,
    script: scriptUpdate,
    upsert: documentUpdate,
    scripted_upsert: scriptedUpsert,
  });
};
