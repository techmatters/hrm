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

import { subHours, subSeconds } from 'date-fns';
import { mockConnection, mockTransaction } from '../mock-db';
import { updateImportProgress, upsertImportedResource } from '../../../src/import/importDataAccess';
import { AccountSID, FlatResource, ImportBatch, ImportProgress } from '@tech-matters/types';
import importService from '../../../src/import/importService';
import { BLANK_ATTRIBUTES } from '../mockResources';
jest.mock('../../../src/import/importDataAccess', () => ({
  updateImportProgress: jest.fn(),
  upsertImportedResource: jest.fn(),
}));
const conn = mockConnection();

const mockUpdateImportProgress = updateImportProgress as jest.MockedFunction<
  typeof updateImportProgress
>;
let mockUpdateProgress: jest.MockedFunction<ReturnType<typeof updateImportProgress>> = jest.fn();
const mockUpsertImportedResource = upsertImportedResource as jest.MockedFunction<
  typeof upsertImportedResource
>;
let mockUpsert: jest.MockedFunction<ReturnType<typeof upsertImportedResource>> = jest.fn();

const BASELINE_DATE = new Date(2012, 11, 4);

const BASELINE_BATCH: ImportBatch = {
  remaining: 100,
  fromDate: subHours(BASELINE_DATE, 12).toISOString(),
  toDate: BASELINE_DATE.toISOString(),
};

const SAMPLE_RESOURCES: FlatResource[] = [
  {
    name: 'Test Resource 50',
    id: 'TEST_RESOURCE_50',
    lastUpdated: subSeconds(BASELINE_DATE, 1).toISOString(),
    ...BLANK_ATTRIBUTES,
  },
  {
    name: 'Test Resource 1',
    id: 'TEST_RESOURCE_1',
    lastUpdated: subHours(BASELINE_DATE, 6).toISOString(),
    ...BLANK_ATTRIBUTES,
  },
  {
    name: 'Test Resource 20',
    id: 'TEST_RESOURCE_20',
    lastUpdated: subSeconds(BASELINE_DATE, 30).toISOString(),
    ...BLANK_ATTRIBUTES,
  },
];

let upsertResources: ReturnType<typeof importService>['upsertResources'];

beforeEach(() => {
  mockTransaction(conn);
  mockUpdateImportProgress.mockReturnValue(mockUpdateProgress);

  mockUpsertImportedResource.mockReturnValue(mockUpsert);
  mockUpsert.mockImplementation((accountSid, { id }) => Promise.resolve({ id, success: true }));
  upsertResources = importService().upsertResources;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('upsertResources', () => {
  test('No resources - noop', async () => {
    await upsertResources('AC_FAKE', [], BASELINE_BATCH);
    expect(mockUpsertImportedResource).not.toHaveBeenCalled();
    expect(mockUpdateImportProgress).not.toHaveBeenCalled();
  });
  test('Several resources - inserted in document order in a transaction, and update progress set to ID with latest updated date in batch', async () => {
    const result = await upsertResources('AC_FAKE', SAMPLE_RESOURCES, BASELINE_BATCH);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    mockUpsert.mock.calls.forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe('AC_FAKE');
      expect(resource).toEqual(SAMPLE_RESOURCES[index]);
    });
    expect(mockUpdateProgress).toHaveBeenCalledWith<[AccountSID, ImportProgress]>('AC_FAKE', {
      ...BASELINE_BATCH,
      lastProcessedId: 'TEST_RESOURCE_50',
      lastProcessedDate: subSeconds(BASELINE_DATE, 1).toISOString(),
    });
    expect(result).toEqual(SAMPLE_RESOURCES.map(({ id }) => ({ id, success: true })));
  });
  test('A resource update throws - aborts transaction & throws', async () => {
    const bork = new Error('bork');
    mockUpsert.mockImplementation(async (accountSid, { id }) => {
      if (id === 'TEST_RESOURCE_1') {
        throw bork;
      }
      return { id, success: true };
    });
    await expect(upsertResources('AC_FAKE', SAMPLE_RESOURCES, BASELINE_BATCH)).rejects.toThrow(
      bork,
    );
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    mockUpsert.mock.calls.slice(0, 2).forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe('AC_FAKE');
      expect(resource).toEqual(SAMPLE_RESOURCES[index]);
    });
    expect(mockUpdateProgress).not.toHaveBeenCalled();
  });
  test('A resource update rejects - aborts transaction & throws', async () => {
    const bork = new Error('bork');
    mockUpsert.mockImplementation(async (accountSid, { id }) => {
      if (id === 'TEST_RESOURCE_1') {
        return Promise.reject(bork);
      }
      return { id, success: true };
    });
    await expect(upsertResources('AC_FAKE', SAMPLE_RESOURCES, BASELINE_BATCH)).rejects.toThrow(
      bork,
    );
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    mockUpsert.mock.calls.slice(0, 2).forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe('AC_FAKE');
      expect(resource).toEqual(SAMPLE_RESOURCES[index]);
    });
    expect(mockUpdateProgress).not.toHaveBeenCalled();
  });
  test('A resource update fails - aborts transaction & throws', async () => {
    const bork = new Error('bork');
    mockUpsert.mockImplementation(async (accountSid, { id }) => {
      return { id, success: false, error: bork };
    });
    await expect(upsertResources('AC_FAKE', SAMPLE_RESOURCES, BASELINE_BATCH)).rejects.toThrow(
      bork,
    );
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [accountSid, resource] = mockUpsert.mock.calls[0];
    expect(accountSid).toBe('AC_FAKE');
    expect(resource).toEqual(SAMPLE_RESOURCES[0]);

    expect(mockUpdateProgress).not.toHaveBeenCalled();
  });

  test('A resource fails validation - rolls back transaction & returns validation error', async () => {
    const brokenResources = [...SAMPLE_RESOURCES];
    const { name, lastUpdated, ...invalidResource } = brokenResources[1];
    brokenResources[1] = invalidResource as FlatResource;
    const result = await upsertResources('AC_FAKE', brokenResources, BASELINE_BATCH);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [accountSid, resource] = mockUpsert.mock.calls[0];
    expect(accountSid).toBe('AC_FAKE');
    expect(resource).toEqual(SAMPLE_RESOURCES[0]);

    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(result).toEqual({
      resource: brokenResources[1],
      reason: 'missing field',
      fields: ['name', 'lastUpdated'],
    });
  });

  test('Progress update rejects - rolls back transaction & throws error', async () => {
    const bork = new Error('bork');
    mockUpdateProgress.mockRejectedValue(bork);
    await expect(upsertResources('AC_FAKE', SAMPLE_RESOURCES, BASELINE_BATCH)).rejects.toThrow(
      bork,
    );
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(mockUpdateProgress).toHaveBeenCalledWith<[AccountSID, ImportProgress]>('AC_FAKE', {
      ...BASELINE_BATCH,
      lastProcessedId: 'TEST_RESOURCE_50',
      lastProcessedDate: subSeconds(BASELINE_DATE, 1).toISOString(),
    });
  });

  test('Progress update throws - rolls back transaction & throws error', async () => {
    const bork = new Error('bork');
    mockUpdateProgress.mockImplementation(() => {
      throw bork;
    });
    await expect(upsertResources('AC_FAKE', SAMPLE_RESOURCES, BASELINE_BATCH)).rejects.toThrow(
      bork,
    );
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(mockUpdateProgress).toHaveBeenCalledWith<[AccountSID, ImportProgress]>('AC_FAKE', {
      ...BASELINE_BATCH,
      lastProcessedId: 'TEST_RESOURCE_50',
      lastProcessedDate: subSeconds(BASELINE_DATE, 1).toISOString(),
    });
  });
});
