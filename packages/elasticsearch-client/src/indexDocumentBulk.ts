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
import { BulkRequest, BulkResponse } from '@elastic/elasticsearch/lib/api/types';
import { PassThroughConfig } from './client';

export type IndexDocumentBulkDocumentItem<T> = {
  id: string;
} & (
  | {
      action: 'index';
      document: T;
    }
  | {
      action: 'delete';
    }
);

export type IndexDocumentBulkDocuments<T> = IndexDocumentBulkDocumentItem<T>[];

export type IndexDocumentBulkExtraParams<T> = {
  documents: IndexDocumentBulkDocuments<T>;
};

export type IndexDocumentBulkParams<T> = PassThroughConfig<T> & IndexDocumentBulkExtraParams<T>;

export type IndexDocumentBulkResponse = BulkResponse;

export const indexDocumentBulk = async <T>({
  client,
  index,
  indexConfig,
  documents,
}: IndexDocumentBulkParams<T>): Promise<IndexDocumentBulkResponse> => {
  const body: BulkRequest['operations'] = documents.flatMap(
    (documentItem): BulkRequest['operations'] => {
      if (documentItem.action === 'delete') {
        return [{ delete: { _index: index, _id: documentItem.id } }];
      } else {
        return [
          { index: { _index: index, _id: documentItem.id } },
          indexConfig.convertToIndexDocument(documentItem.document),
        ];
      }
    },
  );

  console.log('Bulk index resources body', body);

  return client.bulk({
    body,
  });
};
