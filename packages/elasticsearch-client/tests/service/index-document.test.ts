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
import { Client, IndexClient } from '../../';
import { resourceDocuments } from '../fixtures/resources';
import { FlatResource } from '@tech-matters/types';
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

describe('Index Document', () => {
  test('should index a document and refresh automatically every second', async () => {
    const document = resourceDocuments[0];

    await indexClient.indexDocument({ id: document.id, document });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const response = await searchClient.search({
      searchParameters: {
        q: `"${document.name}"`,
      },
    });

    expect(response.total).toBe(1);
    expect(response.items[0].id).toBe(document.id);
  });
});
