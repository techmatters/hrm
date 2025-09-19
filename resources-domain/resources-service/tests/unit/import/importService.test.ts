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
import {
  insertImportError,
  updateImportProgress,
  upsertImportedResource,
} from '../../../src/import/importDataAccess';
import { AccountSID } from '@tech-matters/types';
import {
  FlatResource,
  ImportBatch,
  ImportProgress,
  TimeSequence,
} from '@tech-matters/resources-types';
import importService from '../../../src/import/importService';
import { BLANK_ATTRIBUTES } from '../../mockResources';
import { publishSearchIndexJob } from '../../../src/resource-jobs/client-sqs';

jest.mock('../../../src/import/importDataAccess', () => ({
  updateImportProgress: jest.fn(),
  upsertImportedResource: jest.fn(),
  insertImportError: jest.fn(),
}));

jest.mock('../../../src/resource-jobs/client-sqs.ts', () => ({
  publishSearchIndexJob: jest.fn(),
}));

const mockPublishSearchIndexJob = publishSearchIndexJob as jest.MockedFunction<
  typeof publishSearchIndexJob
>;

const conn = mockConnection();

const mockUpdateImportProgress = updateImportProgress as jest.MockedFunction<
  typeof updateImportProgress
>;
let mockUpdateProgress: jest.MockedFunction<ReturnType<typeof updateImportProgress>> =
  jest.fn();
const mockUpsertImportedResource = upsertImportedResource as jest.MockedFunction<
  typeof upsertImportedResource
>;

let mockUpsert: jest.MockedFunction<ReturnType<typeof upsertImportedResource>> =
  jest.fn();
let mockRecordImportError = insertImportError as jest.MockedFunction<
  typeof insertImportError
>;
let mockRecordError: jest.MockedFunction<ReturnType<typeof insertImportError>> =
  jest.fn();
const timeSequenceFromDate = (date: Date, sequence = 0): TimeSequence =>
  `${date.valueOf()}-${sequence}`;

const BASELINE_DATE = new Date(2012, 11, 4);
const ACCOUNT_SID: AccountSID = 'AC_FAKE';

const BASELINE_BATCH: ImportBatch = {
  remaining: 100,
  fromSequence: timeSequenceFromDate(subHours(BASELINE_DATE, 12)),
  toSequence: timeSequenceFromDate(BASELINE_DATE),
};

const SAMPLE_RESOURCES: FlatResource[] = [
  {
    accountSid: ACCOUNT_SID,
    name: 'Test Resource 50',
    id: 'TEST_RESOURCE_50',
    lastUpdated: subSeconds(BASELINE_DATE, 1).toISOString(),
    ...BLANK_ATTRIBUTES,
  },
  {
    accountSid: ACCOUNT_SID,
    name: 'Test Resource 1',
    id: 'TEST_RESOURCE_1',
    lastUpdated: subHours(BASELINE_DATE, 6).toISOString(),
    ...BLANK_ATTRIBUTES,
  },
  {
    accountSid: ACCOUNT_SID,
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
  mockUpsert.mockImplementation((accountSid, { id }) =>
    Promise.resolve({ id, success: true }),
  );
  upsertResources = importService().upsertResources;
  mockPublishSearchIndexJob.mockResolvedValue(undefined);

  mockRecordImportError.mockReturnValue(mockRecordError);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('upsertResources', () => {
  test('No resources - noop', async () => {
    await upsertResources(ACCOUNT_SID, [], BASELINE_BATCH);
    expect(mockUpsertImportedResource).not.toHaveBeenCalled();
    expect(mockUpdateImportProgress).not.toHaveBeenCalled();
    expect(mockPublishSearchIndexJob).not.toHaveBeenCalled();
  });
  test('Several resources - inserted in document order in a transaction, and update progress set to ID with latest updated date in batch', async () => {
    const result = await upsertResources(ACCOUNT_SID, SAMPLE_RESOURCES, BASELINE_BATCH);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    mockUpsert.mock.calls.forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe(ACCOUNT_SID);
      expect(resource).toEqual(SAMPLE_RESOURCES[index]);
    });
    expect(mockUpdateProgress).toHaveBeenCalledWith<[AccountSID, ImportProgress, number]>(
      ACCOUNT_SID,
      {
        ...BASELINE_BATCH,
        lastProcessedId: 'TEST_RESOURCE_50',
        lastProcessedDate: subSeconds(BASELINE_DATE, 1).toISOString(),
      },
      3,
    );

    expect(mockPublishSearchIndexJob).toHaveBeenCalledTimes(3);
    mockPublishSearchIndexJob.mock.calls.forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe(ACCOUNT_SID);
      expect(resource).toEqual(SAMPLE_RESOURCES[index]);
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
    await expect(
      upsertResources(ACCOUNT_SID, SAMPLE_RESOURCES, BASELINE_BATCH),
    ).rejects.toThrow(bork);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    mockUpsert.mock.calls.slice(0, 2).forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe(ACCOUNT_SID);
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
    await expect(
      upsertResources(ACCOUNT_SID, SAMPLE_RESOURCES, BASELINE_BATCH),
    ).rejects.toThrow(bork);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    mockUpsert.mock.calls.slice(0, 2).forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe(ACCOUNT_SID);
      expect(resource).toEqual(SAMPLE_RESOURCES[index]);
    });
    expect(mockUpdateProgress).not.toHaveBeenCalled();
  });
  test('A resource update fails - aborts transaction & throws', async () => {
    mockUpsert.mockImplementation(async (accountSid, { id }) => {
      return { id, success: false, error: new Error('bork') };
    });
    await expect(
      upsertResources(ACCOUNT_SID, SAMPLE_RESOURCES, BASELINE_BATCH),
    ).rejects.toThrow();
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [accountSid, resource] = mockUpsert.mock.calls[0];
    expect(accountSid).toBe(ACCOUNT_SID);
    expect(resource).toEqual(SAMPLE_RESOURCES[0]);

    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(mockRecordError).toHaveBeenCalledWith(
      ACCOUNT_SID,
      SAMPLE_RESOURCES[0].id,
      BASELINE_BATCH,
      expect.anything(),
      SAMPLE_RESOURCES,
    );
  });

  test('A resource fails validation - rolls back transaction & returns validation error', async () => {
    const brokenResources = [...SAMPLE_RESOURCES];
    const { name, lastUpdated, ...invalidResource } = brokenResources[1];
    brokenResources[1] = invalidResource as FlatResource;
    const result = await upsertResources(ACCOUNT_SID, brokenResources, BASELINE_BATCH);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [accountSid, resource] = mockUpsert.mock.calls[0];
    expect(accountSid).toBe(ACCOUNT_SID);
    expect(resource).toEqual(SAMPLE_RESOURCES[0]);

    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(result).toEqual({
      resource: JSON.stringify(brokenResources[1]),
      reason: 'missing field',
      fields: ['name', 'lastUpdated'],
    });

    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(mockRecordError).toHaveBeenCalledWith(
      ACCOUNT_SID,
      invalidResource.id,
      BASELINE_BATCH,
      expect.anything(),
      brokenResources,
    );
  });

  test('Progress update rejects - rolls back transaction & throws error', async () => {
    const bork = new Error('bork');
    mockUpdateProgress.mockRejectedValue(bork);
    await expect(
      upsertResources(ACCOUNT_SID, SAMPLE_RESOURCES, BASELINE_BATCH),
    ).rejects.toThrow(bork);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(mockUpdateProgress).toHaveBeenCalledWith<[AccountSID, ImportProgress, number]>(
      ACCOUNT_SID,
      {
        ...BASELINE_BATCH,
        lastProcessedId: 'TEST_RESOURCE_50',
        lastProcessedDate: subSeconds(BASELINE_DATE, 1).toISOString(),
      },
      3,
    );
    expect(mockRecordError).toHaveBeenCalledWith(
      ACCOUNT_SID,
      undefined,
      BASELINE_BATCH,
      expect.anything(),
      SAMPLE_RESOURCES,
    );
  });

  test('Progress update throws - rolls back transaction & throws error', async () => {
    const bork = new Error('bork');
    mockUpdateProgress.mockImplementation(() => {
      throw bork;
    });
    await expect(
      upsertResources(ACCOUNT_SID, SAMPLE_RESOURCES, BASELINE_BATCH),
    ).rejects.toThrow(bork);
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    expect(mockUpdateProgress).toHaveBeenCalledWith<[AccountSID, ImportProgress, number]>(
      ACCOUNT_SID,
      {
        ...BASELINE_BATCH,
        lastProcessedId: 'TEST_RESOURCE_50',
        lastProcessedDate: subSeconds(BASELINE_DATE, 1).toISOString(),
      },
      3,
    );
    expect(mockRecordError).toHaveBeenCalledWith(
      ACCOUNT_SID,
      undefined,
      BASELINE_BATCH,
      expect.anything(),
      SAMPLE_RESOURCES,
    );
  });

  test('Publishing to the reindex queue throws - continues', async () => {
    mockRecordError.mockClear();
    mockPublishSearchIndexJob.mockImplementation(() => {
      throw new Error('bork');
    });
    try {
      await upsertResources(ACCOUNT_SID, SAMPLE_RESOURCES, BASELINE_BATCH);
    } catch (err) {
      // Bug in jest still counts async functions where errors are caught as rejections
      // While this is far from ideal, the interactions being verified below prove the code kept running after the error
    }
    expect(mockUpsertImportedResource).toHaveBeenCalledWith(expect.anything());
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    mockUpsert.mock.calls.forEach(([accountSid, resource], index) => {
      expect(accountSid).toBe(ACCOUNT_SID);
      expect(resource).toEqual(SAMPLE_RESOURCES[index]);
    });
    expect(mockUpdateProgress).toHaveBeenCalledWith<[AccountSID, ImportProgress, number]>(
      ACCOUNT_SID,
      {
        ...BASELINE_BATCH,
        lastProcessedId: 'TEST_RESOURCE_50',
        lastProcessedDate: subSeconds(BASELINE_DATE, 1).toISOString(),
      },
      3,
    );
  });
});
