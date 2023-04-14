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

// TODO: handle document to body conversion based on a config file for this user/index

export type IndexDocumentExtraParams = {
  id: string;
  document: any;
};

export type IndexDocumentParams = PassThroughConfig & IndexDocumentExtraParams;

export type IndexDocumentResponse = IndexResponse;

export const indexDocument = async ({
  client,
  document,
  id,
  index,
  indexConfig,
}: IndexDocumentParams): Promise<IndexDocumentResponse> => {
  const convertedDocument = indexConfig.convertIndexDocument(document);

  return client.index({
    index,
    id,
    document: convertedDocument,
  });
};

export default indexDocument;
