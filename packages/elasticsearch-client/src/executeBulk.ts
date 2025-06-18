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
import createIndex from './createIndex';

export type BulkOperation<T> = {
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

export type BulkOperations<T> = BulkOperation<T>[];

export type ExecuteBulkExtraParams<T> = {
  documents: BulkOperations<T>;
  autocreate?: boolean;
};

export type ExecuteBulkParams<T> = PassThroughConfig<T> & ExecuteBulkExtraParams<T>;

export type ExecuteBulkResponse = BulkResponse;

export const executeBulk = async <T>({
  client,
  index,
  indexConfig,
  documents,
  autocreate = false,
}: ExecuteBulkParams<T>): Promise<ExecuteBulkResponse> => {
  if (autocreate) {
    // const exists = await client.indices.exists({ index });
    // NOTE: above check is already performed in createIndex
    await createIndex({ client, index, indexConfig });
  }

  const body: BulkRequest['operations'] = documents.flatMap(
    (documentItem): BulkRequest['operations'] => {
      if (documentItem.action === 'delete') {
        return [{ delete: { _index: index, _id: documentItem.id } }];
      } else {
        return [
          { index: { _index: index, _id: documentItem.id } },
          indexConfig.convertToIndexDocument(documentItem.document, index).unwrap(), // unwrap will force an error aborting the entire bulk, maybe we should handle more gracefully
        ];
      }
    },
  );

  console.log('Bulk index resources body', body);

  return client.bulk({
    body,
  });
};
