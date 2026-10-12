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

import { getClient } from '../../src';
import { BulkOperations, Client, IndexClient } from '../..';
import { resourceDocuments } from '../fixtures/resources';
import { FlatResource } from '@tech-matters/resources-types/Resources';
import {
  resourceIndexConfiguration,
  resourceSearchConfiguration,
} from '../fixtures/configuration';

const accountSid = 'service-test-index-document';
const indexType = 'resources';

let indexClient: IndexClient<FlatResource>;
let searchClient: ReturnType<Client['searchClient']>;

afterAll(async () => {
  await indexClient.deleteIndex();
});

beforeAll(async () => {
  const client = await getClient({
    accountSid,
    indexType,
    config: {
      node: 'http://localhost:9200',
    },
  });

  indexClient = client.indexClient(resourceIndexConfiguration);
  searchClient = client.searchClient(resourceSearchConfiguration);

  await indexClient.createIndex({});
});

describe('Index Documents Bulk', () => {
  test('when passed a list of documents, should index all documents', async () => {
    const documents: BulkOperations<FlatResource> = resourceDocuments.map(doc => ({
      action: 'index',
      id: doc.id,
      document: doc,
    }));

    await indexClient.executeBulk({ documents });
    await indexClient.refreshIndex();
    const response = await searchClient.search({
      searchParameters: {
        q: `*`,
      },
    });

    expect(response.total).toBe(documents.length);
    documents.forEach(doc => {
      expect(response.items).toContainEqual({
        id: doc.id,
        hits: undefined,
      });
    });
  });
});
