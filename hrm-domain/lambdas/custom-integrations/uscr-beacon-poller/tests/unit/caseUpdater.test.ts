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

import { NewCaseSection } from '../../src/types';
import { addSectionToAseloCase } from '../../src/caseUpdater';
import { isErr, isOk } from '@tech-matters/types';
import { AssertionError } from 'node:assert';

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn();

global.fetch = mockFetch;

type Chicken = {
  id: string;
  case_id: string;
  chicken_counter: number;
  boc: 'boc' | 'bwaaaaak' | 'bocARGGH';
};

describe('addSectionToAseloCase', () => {
  const verifyAddSectionRequest = (
    caseId: string,
    expectedCaseSection: NewCaseSection,
  ) => {
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/${caseId}/sections/chicken`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.STATIC_KEY}`,
        },
        body: JSON.stringify(expectedCaseSection),
      },
    );
  };

  const chickenAdder = addSectionToAseloCase('chicken', (chicken: Chicken) => {
    return {
      caseId: chicken.case_id,
      section: {
        sectionId: chicken.id,
        sectionTypeSpecificData: {
          boc: chicken.boc,
        },
      },
      lastUpdated: chicken.chicken_counter.toString(),
    };
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'OK' }),
    } as Response);
  });

  test('most beacon incident report properties map to equivalents in the Aselo case section', async () => {
    const result = await chickenAdder(
      {
        case_id: '1234',
        id: '5678',
        boc: 'bocARGGH',
        chicken_counter: 42,
      },
      '40',
    );
    verifyAddSectionRequest('1234', {
      sectionId: '5678',
      sectionTypeSpecificData: {
        boc: 'bocARGGH',
      },
    });
    if (isOk(result)) {
      expect(result.unwrap()).toEqual('42');
    } else throw new AssertionError({ message: 'Did not expect error', actual: result });
  });
  test('Service responds with 409 - returns warn level error result', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => 'Already exists',
    } as Response);
    const result = await chickenAdder(
      {
        case_id: '1234',
        id: '5678',
        boc: 'bocARGGH',
        chicken_counter: 42,
      },
      '40',
    );
    if (isErr(result)) {
      expect(result.error).toEqual({
        level: 'warn',
        caseId: '1234',
        lastUpdated: '42',
        sectionId: '5678',
        type: 'SectionExists',
      });
    } else {
      throw new AssertionError({ message: 'Expected error', actual: result });
    }
    verifyAddSectionRequest('1234', {
      sectionId: '5678',
      sectionTypeSpecificData: {
        boc: 'bocARGGH',
      },
    });
  });
  test('Service responds with 404 - returns warn level error result', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'No case',
    } as Response);
    const result = await chickenAdder(
      {
        case_id: '1234',
        id: '5678',
        boc: 'bocARGGH',
        chicken_counter: 42,
      },
      '40',
    );
    if (isErr(result)) {
      expect(result.error).toEqual({
        level: 'warn',
        caseId: '1234',
        lastUpdated: '42',
        sectionId: '5678',
        type: 'CaseNotFound',
      });
    } else {
      throw new AssertionError({ message: 'Expected error', actual: result });
    }
    verifyAddSectionRequest('1234', {
      sectionId: '5678',
      sectionTypeSpecificData: {
        boc: 'bocARGGH',
      },
    });
  });
  test('Service responds with 500 - returns error level error result', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'No case',
    } as Response);
    const result = await chickenAdder(
      {
        case_id: '1234',
        id: '5678',
        boc: 'bocARGGH',
        chicken_counter: 42,
      },
      '40',
    );
    if (isErr(result)) {
      expect(result.error).toEqual({
        level: 'error',
        status: 500,
        lastUpdated: '42',
        type: 'UnexpectedHttpError',
        body: 'No case',
      });
    } else {
      throw new AssertionError({ message: 'Expected error', actual: result });
    }
    verifyAddSectionRequest('1234', {
      sectionId: '5678',
      sectionTypeSpecificData: {
        boc: 'bocARGGH',
      },
    });
  });
  test('No case id provided - returns error without requesting', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'No case',
    } as Response);
    const result = await chickenAdder(
      {
        case_id: undefined as any,
        id: '5678',
        boc: 'bocARGGH',
        chicken_counter: 42,
      },
      '40',
    );
    if (isErr(result)) {
      expect(result.error).toEqual({
        level: 'error',
        lastUpdated: '42',
        sectionId: '5678',
        type: 'CaseNotSpecified',
      });
    } else {
      throw new AssertionError({ message: 'Expected error', actual: result });
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });
  test('Last updated value equals last seen value - skips, returning ok result without adding a section', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => 'No case',
    } as Response);
    const result = await chickenAdder(
      {
        case_id: '1234',
        id: '5678',
        boc: 'bocARGGH',
        chicken_counter: 42,
      },
      '42',
    );
    if (isOk(result)) {
      expect(result.data).toEqual('42');
    } else {
      throw new AssertionError({ message: 'Did not expect error', actual: result });
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });
  test('Error caused by something other than HTTP response code', async () => {
    const thrownError = new Error('boom');
    mockFetch.mockImplementation(() => {
      throw thrownError;
    });
    const result = await chickenAdder(
      {
        case_id: 'boc',
        id: '5678',
        boc: 'bocARGGH',
        chicken_counter: 42,
      },
      '40',
    );
    if (isErr(result)) {
      expect(result.error).toEqual({
        level: 'error',
        thrownError,
        type: 'UnexpectedError',
      });
      expect(result.message).toEqual('boom');
    } else {
      throw new AssertionError({ message: 'Expected error', actual: result });
    }
  });
});
