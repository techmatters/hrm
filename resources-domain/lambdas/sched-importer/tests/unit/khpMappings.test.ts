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
import each from 'jest-each';
import {
  failingId,
  khpResources_20240822,
  khpResourceWithAncestorTaxonmies,
  khpResourceWithoutSites,
  khpResourceWithSites,
  khpSampleResource_20240418,
  khpSampleResource_20240418_2,
  withSites_20240823,
} from '../fixtures/sampleResources';
import { transformKhpResourceToApiResource } from '../../src/khpMappings';

/**
 * Not the most scientific tests, but a vehicle to verify we are handling the real data correctly as it evolves.
 */
describe('Mapping valid sample resources should produce no warnings', () => {
  type TestCase = {
    description: string;
    resource: any;
  };

  const testCases: TestCase[] = [
    {
      description: 'KHP resource with ancestor taxonomies',
      resource: khpResourceWithAncestorTaxonmies,
    },
    {
      description: 'KHP resource with no sites',
      resource: khpResourceWithoutSites,
    },
    {
      description: 'KHP resource with sites',
      resource: khpResourceWithSites,
    },
    {
      description: 'KHP resource after API update',
      resource: khpSampleResource_20240418,
    },
    {
      description: 'KHP resource after API update 2',
      resource: khpSampleResource_20240418_2,
    },
    {
      description: 'KHP resource failing id after API update 2',
      resource: failingId,
    },
    ...khpResources_20240822.map((resource, idx) => ({
      description: `KHP resource from 2024-08-22 ${idx} (${resource._id})`,
      resource,
    })),
    {
      description: 'withSites_20240823',
      resource: withSites_20240823,
    },
  ];

  each(testCases).test('$description', ({ resource }) => {
    const warnSpy = jest.spyOn(console, 'warn');
    try {
      console.log(
        JSON.stringify(transformKhpResourceToApiResource('AC000', resource), null, 2),
      );
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
