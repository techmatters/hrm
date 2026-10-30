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

import type { Client as EsClient } from '@elastic/elasticsearch';
import { updateScript } from './updateDocument';
import { IndexConfiguration } from './config';

type Document = { id: string };

const scriptUpdate = { source: 'script source', params: {} };
const indexConfig = {
  convertToScriptUpdate: (document: Document) => ({
    documentUpdate: document,
    scriptUpdate,
  }),
} as unknown as IndexConfiguration<Document>;

const fakeClient = (update: jest.Mock) => ({ update }) as unknown as EsClient;

describe('updateScript', () => {
  test('passes retryOnConflict to Elasticsearch as retry_on_conflict', async () => {
    const update = jest.fn().mockResolvedValue({ result: 'updated' });

    await updateScript({
      client: fakeClient(update),
      index: 'index',
      indexConfig,
      id: '42',
      document: { id: '42' },
      scriptedUpsert: true,
      retryOnConflict: 5,
    });

    expect(update).toHaveBeenCalledWith({
      index: 'index',
      id: '42',
      script: scriptUpdate,
      upsert: { id: '42' },
      scripted_upsert: true,
      retry_on_conflict: 5,
    });
  });

  test('leaves retry_on_conflict to the Elasticsearch default when retryOnConflict is not set', async () => {
    const update = jest.fn().mockResolvedValue({ result: 'updated' });

    await updateScript({
      client: fakeClient(update),
      index: 'index',
      indexConfig,
      id: '42',
      document: { id: '42' },
    });

    expect(update.mock.calls[0][0].retry_on_conflict).toBeUndefined();
  });
});
