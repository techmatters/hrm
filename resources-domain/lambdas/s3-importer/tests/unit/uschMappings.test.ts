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
import {
  expandCsvLine,
  transformUschResourceToApiResource,
  UschExpandedResource,
} from '../../src/uschMappings';
import each from 'jest-each';
import { EMPTY_CSV_LINE, EMPTY_EXPANDED_RESOURCE } from '../fixtures/sampleResources';

const TEST_RESOURCE_ID = 'test-id';

describe('expandCsvLine', () => {
  test('Empty csv line - outputs empty expanded resource', async () => {
    const result: UschExpandedResource = expandCsvLine({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
    });
    expect(result).toStrictEqual({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Coverage: [],
      Categories: [],
    });
  });
  test('Csv line with single category - outputs expanded resource with single item category array', async () => {
    const result: UschExpandedResource = expandCsvLine({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Categories: 'One category',
    });
    expect(result).toStrictEqual({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Coverage: [],
      Categories: ['One category'],
    });
  });
  test('Csv line with multiple categories seperated by semi-colons - outputs expanded resource with category array without trimming', async () => {
    const result: UschExpandedResource = expandCsvLine({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Categories: 'A ;few; categories',
    });
    expect(result).toStrictEqual({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Coverage: [],
      Categories: ['A ', 'few', ' categories'],
    });
  });
  test('Csv line with single coverage item - outputs expanded resource with single item coverage array', async () => {
    const result: UschExpandedResource = expandCsvLine({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Coverage: 'One coverage',
    });
    expect(result).toStrictEqual({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Coverage: ['One coverage'],
      Categories: [],
    });
  });
  test('Csv line with multiple coverage seperated by semi-colons - outputs expanded resource with coverage array without trimming', async () => {
    const result: UschExpandedResource = expandCsvLine({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Coverage: 'A ;few; coverages',
    });
    expect(result).toStrictEqual({
      ...EMPTY_CSV_LINE,
      ResourceID: TEST_RESOURCE_ID,
      Coverage: ['A ', 'few', ' coverages'],
      Categories: [],
    });
  });
});

/**
 * Not the most scientific tests, but a vehicle to verify we are handling the real data correctly as it evolves.
 */
describe('Mapping valid sample resources should produce no warnings', () => {
  type TestCase = {
    description: string;
    resource: UschExpandedResource;
  };

  const testCases: TestCase[] = [
    {
      description: 'Empty resource',
      resource: {
        ...EMPTY_EXPANDED_RESOURCE,
        ResourceID: 'EMPTY_RESOURCE',
      },
    },
    {
      description: 'Resource with address',
      resource: {
        ...EMPTY_EXPANDED_RESOURCE,
        ResourceID: 'ADDRESS_RESOURCE',
        Address: '123 Fake Street',
        City: 'City Wok',
        StateProvince: 'Provence',
        Country: 'AND Western',
        PostalCode: 'P05 4C0D3',
      },
    },
    {
      description: 'Resource with phone numbers',
      resource: {
        ...EMPTY_EXPANDED_RESOURCE,
        ResourceID: 'PHONE_RESOURCE',
        Phone1: '1234567',
        Phone1Name: 'Batphone',
        Phone1Description: 'A phone for bats',
        Phone2: '12345678',
        Phone2Name: 'Bigphone',
        Phone2Description: 'A phone for Biggs',
        PhoneAfterHours: '7654321',
        PhoneAfterHoursDescription: 'Hot girls and boys want to chat with YOU',
        PhoneHotline: '87654321',
        PhoneHotlineDescription: 'Very serious hotline for very serious matters',
      },
    },
    {
      description: 'Resource with verification',
      resource: {
        ...EMPTY_EXPANDED_RESOURCE,
        ResourceID: 'VERIFICATION_RESOURCE',
        LastVerificationApprovedBy: 'Bob',
        LastVerifiedByEmailAddress: 'lorna@ballantyne.com',
        LastVerifiedByName: 'Lorna Ballantyne',
        LastVerifiedByTitle: 'Miss',
        LastVerifiedByPhoneNumber: '1234567',
        LastVerifiedOn: 'last week',
      },
    },
    {
      description: 'Resource with categories',
      resource: {
        ...EMPTY_EXPANDED_RESOURCE,
        ResourceID: 'CATEGORY_RESOURCE',
        Categories: ['CATEGORY 1', 'CATEGORY 2', 'CATEGORY 3'],
      },
    },
    {
      description: 'Resource with coverage',
      resource: {
        ...EMPTY_EXPANDED_RESOURCE,
        ResourceID: 'EMPTY_RESOURCE',
        Coverage: ['COVERAGE 1', 'COVERAGE 2', 'COVERAGE 3'],
      },
    },
  ];

  each(testCases).test('$description has no warnings', ({ resource }) => {
    const warnSpy = jest.spyOn(console, 'warn');
    try {
      console.log(
        JSON.stringify(transformUschResourceToApiResource('AC000', resource), null, 2),
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
