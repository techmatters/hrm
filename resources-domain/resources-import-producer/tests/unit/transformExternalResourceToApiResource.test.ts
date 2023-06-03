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
  transformExternalResourceToApiResource,
  transformKhpResourceToApiResource,
} from '../../src/transformExternalResourceToApiResource';
import {
  MappingNode,
  resourceFieldMapping,
  attributeMapping,
  referenceAttributeMapping,
  translatableAttributeMapping,
} from '../../src/mappers';
import { AccountSID, FlatResource } from '@tech-matters/types';
import each from 'jest-each';

const startedDate = new Date().toISOString();
const ACCOUNT_SID: AccountSID = 'AC000';

const mergeWithCleanResource = (partialResource: Partial<FlatResource> = {}): FlatResource => ({
  ...{
    accountSid: ACCOUNT_SID,
    id: partialResource.id || '',
    lastUpdated: partialResource.lastUpdated || '',
    name: partialResource.name || '',
    stringAttributes: partialResource.stringAttributes || [],
    numberAttributes: partialResource.numberAttributes || [],
    booleanAttributes: partialResource.booleanAttributes || [],
    dateTimeAttributes: partialResource.dateTimeAttributes || [],
    referenceStringAttributes: partialResource.referenceStringAttributes || [],
  },
});

describe('Dynamic captures', () => {
  test('Mapping an attribute with dynamic capture only - should captures all the keys', async () => {
    const resource = {
      attribute: {
        key1: 'value 1',
        key2: 'value 2',
      },
    };

    const mapping: MappingNode = {
      attribute: {
        children: {
          '{key}': attributeMapping('stringAttributes', '{key}'),
        },
      },
    };

    const expected: FlatResource = mergeWithCleanResource({
      stringAttributes: [
        {
          key: 'key1',
          value: 'value 1',
          info: null,
          language: '',
        },
        {
          key: 'key2',
          value: 'value 2',
          info: null,
          language: '',
        },
      ],
    });

    const result = transformExternalResourceToApiResource(mapping, ACCOUNT_SID, resource);
    expect(result).toMatchObject(expected);
  });

  test('Mapping an attribute with dynamic and static capture - should capture only the non-static keys', async () => {
    const resource = {
      attribute: {
        another: true,
        key1: 'value 1',
        key2: 'value 2',
      },
    };

    const mapping: MappingNode = {
      attribute: {
        children: {
          another: attributeMapping('booleanAttributes', 'another'),
          '{key}': attributeMapping('stringAttributes', '{key}'),
        },
      },
    };

    const expected: FlatResource = mergeWithCleanResource({
      stringAttributes: [
        {
          key: 'key1',
          value: 'value 1',
          info: null,
          language: '',
        },
        {
          key: 'key2',
          value: 'value 2',
          info: null,
          language: '',
        },
      ],
      booleanAttributes: [
        {
          key: 'another',
          value: true,
          info: null,
        },
      ],
    });

    const result = transformExternalResourceToApiResource(mapping, ACCOUNT_SID, resource);
    expect(result).toMatchObject(expected);
  });
});

describe('Simple mappings with flat structure', () => {
  const testCases: {
    description: string;
    mapping: MappingNode;
    resource: Record<string, any>;
    expectedFromResource: (r: Record<string, any>) => FlatResource;
  }[] = [
    // Base case
    {
      description:
        'when node contains empty value and is expecteded something to map,  should stop recursing',
      mapping: {
        attribute: attributeMapping('booleanAttributes', 'booleanAttribute'),
      },
      resource: {},
      expectedFromResource: () => mergeWithCleanResource(),
    },
    // Top level resource
    {
      description:
        'when mapping resourceFieldMapping on id, name and updatedAt, should add those as top level properties of resource',
      mapping: {
        objectId: resourceFieldMapping('id'),
        name: resourceFieldMapping('name', ctx => ctx.currentValue.en),
        updatedAt: resourceFieldMapping('lastUpdated'),
      },
      resource: {
        name: { en: 'resource-1' },
        objectId: 'resource-1',
        updatedAt: startedDate,
      },
      expectedFromResource: r =>
        mergeWithCleanResource({
          id: r.objectId,
          lastUpdated: r.updatedAt,
          name: r.name.en,
        }),
    },
    // booleanAttributes
    {
      description:
        'when mapping booleanAttributes without info property - should add booleanAttributes record with null info',
      mapping: {
        attribute: attributeMapping('booleanAttributes', 'booleanAttribute'),
      },
      resource: {
        attribute: true,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          booleanAttributes: [
            {
              info: null,
              key: 'booleanAttribute',
              value: true,
            },
          ],
        }),
    },
    {
      description:
        'when mapping booleanAttributes with info property - should add booleanAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('booleanAttributes', 'booleanAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: true,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          booleanAttributes: [
            {
              info: { attribute: true },
              key: 'booleanAttribute',
              value: true,
            },
          ],
        }),
    },
    // stringAttributes
    {
      description:
        'when mapping ResourceStringAttributes without info property - should add ResourceStringAttributes record with null info',
      mapping: {
        attribute: attributeMapping('stringAttributes', 'stringAttribute'),
      },
      resource: {
        attribute: 'some string',
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          stringAttributes: [
            {
              language: '',
              info: null,
              key: 'stringAttribute',
              value: 'some string',
            },
          ],
        }),
    },
    {
      description:
        'when mapping ResourceStringAttributes with info property - should add ResourceStringAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('stringAttributes', 'stringAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: 'some string',
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          stringAttributes: [
            {
              language: '',
              info: { attribute: 'some string' },
              key: 'stringAttribute',
              value: 'some string',
            },
          ],
        }),
    },
    // Translatable ResourceStringAttributes
    {
      description:
        'when mapping Translatable stringAttributes without info property - should add Translatable ResourceStringAttributes record with null info',
      mapping: {
        attribute: {
          children: {
            '{language}': translatableAttributeMapping('translatableAttribute/{language}', {
              language: ctx => ctx.captures.language,
            }),
          },
        },
      },
      resource: { attribute: { en: 'some string' } },
      expectedFromResource: () =>
        mergeWithCleanResource({
          stringAttributes: [
            {
              language: 'en',
              info: null,
              key: 'translatableAttribute/en',
              value: 'some string',
            },
          ],
        }),
    },
    {
      description:
        'when mapping Translatable ResourceStringAttributes with info property - should add Translatable ResourceStringAttributes record with populated info',
      mapping: {
        attribute: {
          children: {
            '{language}': translatableAttributeMapping('translatableAttribute/{language}', {
              language: ctx => ctx.captures.language,
              info: ctx => ({ attribute: ctx.currentValue }),
            }),
          },
        },
      },
      resource: { attribute: { en: 'some string' } },
      expectedFromResource: () =>
        mergeWithCleanResource({
          stringAttributes: [
            {
              language: 'en',
              info: { attribute: 'some string' },
              key: 'translatableAttribute/en',
              value: 'some string',
            },
          ],
        }),
    },
    // numberAttributes
    {
      description:
        'when mapping numberAttributes without info property - should add numberAttributes record with null info',
      mapping: {
        attribute: attributeMapping('numberAttributes', 'numberAttribute'),
      },
      resource: {
        attribute: 1,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          numberAttributes: [
            {
              info: null,
              key: 'numberAttribute',
              value: 1,
            },
          ],
        }),
    },
    {
      description:
        'when mapping numberAttributes with info property - should add numberAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('numberAttributes', 'numberAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: 1,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          numberAttributes: [
            {
              info: { attribute: 1 },
              key: 'numberAttribute',
              value: 1,
            },
          ],
        }),
    },
    // dateTimeAttributes
    {
      description:
        'when mapping dateTimeAttributes without info property - should add dateTimeAttributes record with null info',
      mapping: {
        attribute: attributeMapping('dateTimeAttributes', 'dateAttribute'),
      },
      resource: {
        attribute: startedDate,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          dateTimeAttributes: [
            {
              info: null,
              key: 'dateAttribute',
              value: startedDate,
            },
          ],
        }),
    },
    {
      description:
        'when mapping dateTimeAttributes with info property - should add dateTimeAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('dateTimeAttributes', 'dateAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: startedDate,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          dateTimeAttributes: [
            {
              info: { attribute: startedDate },
              key: 'dateAttribute',
              value: startedDate,
            },
          ],
        }),
    },
    // referenceStringAttributes
    {
      description:
        'when mapping referenceStringAttributes - should add referenceStringAttributes record',
      mapping: {
        attribute: referenceAttributeMapping('referenceAttribute', 'some-list', {
          value: ctx => ctx.currentValue.id,
        }),
      },
      resource: {
        attribute: { id: 'ref-id', value: 'reference value' },
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          referenceStringAttributes: [
            {
              language: '',
              key: 'referenceAttribute',
              value: 'ref-id',
              list: 'some-list',
            },
          ],
        }),
    },
  ];

  each(testCases).test('$description', async ({ mapping, resource, expectedFromResource }) => {
    const expected = expectedFromResource(resource);
    const result = transformExternalResourceToApiResource(mapping, ACCOUNT_SID, resource);
    expect(result).toMatchObject(expected);
  });
});

describe('Simple mapping, nested structure', () => {
  const testCases: {
    description: string;
    mapping: MappingNode;
    resource: Record<string, any>;
    expectedFromResource: (r: Record<string, any>) => FlatResource;
  }[] = [
    // Base case
    {
      description:
        'when node contains empty value and is expecteded something to map,  should stop recursing',
      mapping: {
        attribute: {
          children: {
            nested: attributeMapping('booleanAttributes', 'booleanAttribute'),
          },
        },
      },
      resource: {},
      expectedFromResource: () => mergeWithCleanResource(),
    },
    // Top level resource
    {
      description:
        'when mapping resourceFieldMapping on id, name and updatedAt, should add those as top level properties of resource',
      mapping: {
        importantObject: {
          children: {
            id: resourceFieldMapping('id'),
            name: resourceFieldMapping('name', ctx => ctx.currentValue.en),
            updatedAt: resourceFieldMapping('lastUpdated'),
          },
        },
      },
      resource: {
        importantObject: {
          id: 'resource-1',
          name: { en: 'resource-1' },
          updatedAt: startedDate,
        },
      },
      expectedFromResource: r =>
        mergeWithCleanResource({
          id: r.importantObject.id,
          lastUpdated: r.importantObject.updatedAt,
          name: r.importantObject.name.en,
        }),
    },
    // booleanAttributes
    {
      description:
        'when mapping booleanAttributes without info property - should add booleanAttributes records with null info',
      mapping: {
        booleans: {
          children: {
            '{property}': attributeMapping('booleanAttributes', '{property}'),
          },
        },
      },
      resource: {
        booleans: {
          booleanAttribute1: true,
          booleanAttribute2: false,
        },
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          booleanAttributes: [
            {
              info: null,
              key: 'booleanAttribute1',
              value: true,
            },
            {
              info: null,
              key: 'booleanAttribute2',
              value: false,
            },
          ],
        }),
    },
    // ResourceStringAttributes
    {
      description:
        'when mapping ResourceStringAttributes without info property - should add ResourceStringAttributes records with null info',
      mapping: {
        strings: {
          children: {
            '{property}': attributeMapping('stringAttributes', '{property}'),
          },
        },
      },
      resource: {
        strings: {
          stringAttribute1: 'some string',
          stringAttribute2: 'another string',
        },
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          stringAttributes: [
            {
              language: '',
              info: null,
              key: 'stringAttribute1',
              value: 'some string',
            },
            {
              language: '',
              info: null,
              key: 'stringAttribute2',
              value: 'another string',
            },
          ],
        }),
    },
    // Translatable ResourceStringAttributes
    {
      description:
        'when mapping Translatable ResourceStringAttributes without info property - should add Translatable ResourceStringAttributes records with null info',
      mapping: {
        strings: {
          children: {
            '{language}': {
              children: {
                '{property}': translatableAttributeMapping(
                  ctx => `translatableAttribute/${ctx.captures.language}/${ctx.captures.property}`,
                  {
                    language: ctx => ctx.captures.language,
                  },
                ),
              },
            },
          },
        },
      },
      resource: {
        strings: {
          en: {
            stringAttribute1: 'some string',
            stringAttribute2: 'another string',
          },
        },
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          stringAttributes: [
            {
              language: 'en',
              info: null,
              key: 'translatableAttribute/en/stringAttribute1',
              value: 'some string',
            },
            {
              language: 'en',
              info: null,
              key: 'translatableAttribute/en/stringAttribute2',
              value: 'another string',
            },
          ],
        }),
    },
    // numberAttributes
    {
      description:
        'when mapping numberAttributes without info property - should add numberAttributes records with null info',
      mapping: {
        numbers: {
          children: {
            '{property}': attributeMapping('numberAttributes', '{property}'),
          },
        },
      },
      resource: {
        numbers: {
          numberAttribute1: 1,
          numberAttribute2: 2,
        },
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          numberAttributes: [
            {
              info: null,
              key: 'numberAttribute1',
              value: 1,
            },
            {
              info: null,
              key: 'numberAttribute2',
              value: 2,
            },
          ],
        }),
    },
    // dateTimeAttributes
    {
      description:
        'when mapping dateTimeAttributes without info property - should add dateTimeAttributes records with null info',
      mapping: {
        dates: {
          children: {
            '{property}': attributeMapping('dateTimeAttributes', '{property}'),
          },
        },
      },
      resource: {
        dates: {
          dateAttribute1: startedDate,
          dateAttribute2: startedDate,
        },
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          dateTimeAttributes: [
            {
              info: null,
              key: 'dateAttribute1',
              value: startedDate,
            },
            {
              info: null,
              key: 'dateAttribute2',
              value: startedDate,
            },
          ],
        }),
    },
    // referenceStringAttributes
    {
      description:
        'when mapping referenceStringAttributes without info property - should add referenceStringAttributes records with null info',
      mapping: {
        references: {
          children: {
            '{property}': referenceAttributeMapping('{property}', 'some-list', {
              value: ctx => ctx.currentValue.id,
            }),
          },
        },
      },
      resource: {
        references: {
          referenceAttribute1: { id: 'ref-1', value: 'reference value 1' },
          referenceAttribute2: { id: 'ref-2', value: 'reference value 2' },
        },
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          referenceStringAttributes: [
            {
              language: '',
              key: 'referenceAttribute1',
              value: 'ref-1',
              list: 'some-list',
            },
            {
              language: '',
              key: 'referenceAttribute2',
              value: 'ref-2',
              list: 'some-list',
            },
          ],
        }),
    },
  ];

  each(testCases).test('$description', async ({ mapping, resource, expectedFromResource }) => {
    const expected = expectedFromResource(resource);
    const result = transformExternalResourceToApiResource(mapping, ACCOUNT_SID, resource);
    expect(result).toMatchObject(expected);
  });

  test('when mapping all kinds of attributes - should add each kind of record under corresponding record.attributes key', async () => {
    const resource = {
      importantObject: {
        id: 'resource-1',
        name: { en: 'resource-1' },
        updatedAt: startedDate,
      },
      booleans: {
        booleanAttribute1: true,
        booleanAttribute2: false,
      },
      strings: {
        stringAttribute1: 'some string',
        stringAttribute2: 'another string',
      },
      translatableStrings: {
        en: {
          stringAttribute1: 'some string',
          stringAttribute2: 'another string',
        },
      },
      numbers: {
        numberAttribute1: 1,
        numberAttribute2: 2,
      },
      dates: {
        dateAttribute1: startedDate,
        dateAttribute2: startedDate,
      },
      references: {
        referenceAttribute1: { id: 'ref-1', value: 'reference value 1' },
        referenceAttribute2: { id: 'ref-2', value: 'reference value 2' },
      },
    };

    const mapping = {
      importantObject: {
        children: {
          id: resourceFieldMapping('id'),
          name: resourceFieldMapping('name', ctx => ctx.currentValue.en),
          updatedAt: resourceFieldMapping('lastUpdated'),
        },
      },
      booleans: {
        children: {
          '{property}': attributeMapping('booleanAttributes', '{property}'),
        },
      },
      strings: {
        children: {
          '{property}': attributeMapping('stringAttributes', '{property}'),
        },
      },
      translatableStrings: {
        children: {
          '{language}': {
            children: {
              '{property}': translatableAttributeMapping(
                ctx => `translatableAttribute/${ctx.captures.language}/${ctx.captures.property}`,
                {
                  language: ctx => ctx.captures.language,
                },
              ),
            },
          },
        },
      },
      numbers: {
        children: {
          '{property}': attributeMapping('numberAttributes', '{property}'),
        },
      },
      dates: {
        children: {
          '{property}': attributeMapping('dateTimeAttributes', '{property}'),
        },
      },
      references: {
        children: {
          '{property}': referenceAttributeMapping('{property}', 'some-list', {
            value: ctx => ctx.currentValue.id,
          }),
        },
      },
    };

    const expected: FlatResource = {
      accountSid: ACCOUNT_SID,
      id: resource.importantObject.id,
      lastUpdated: resource.importantObject.updatedAt,
      name: resource.importantObject.name.en,

      booleanAttributes: [
        {
          info: null,
          key: 'booleanAttribute1',
          value: true,
        },
        {
          info: null,
          key: 'booleanAttribute2',
          value: false,
        },
      ],
      stringAttributes: [
        {
          language: '',
          info: null,
          key: 'stringAttribute1',
          value: 'some string',
        },
        {
          language: '',
          info: null,
          key: 'stringAttribute2',
          value: 'another string',
        },
        {
          language: 'en',
          info: null,
          key: 'translatableAttribute/en/stringAttribute1',
          value: 'some string',
        },
        {
          language: 'en',
          info: null,
          key: 'translatableAttribute/en/stringAttribute2',
          value: 'another string',
        },
      ],
      numberAttributes: [
        {
          info: null,
          key: 'numberAttribute1',
          value: 1,
        },
        {
          info: null,
          key: 'numberAttribute2',
          value: 2,
        },
      ],
      dateTimeAttributes: [
        {
          info: null,
          key: 'dateAttribute1',
          value: startedDate,
        },
        {
          info: null,
          key: 'dateAttribute2',
          value: startedDate,
        },
      ],
      referenceStringAttributes: [
        {
          language: '',
          key: 'referenceAttribute1',
          value: 'ref-1',
          list: 'some-list',
        },
        {
          language: '',
          key: 'referenceAttribute2',
          value: 'ref-2',
          list: 'some-list',
        },
      ],
    };

    const result = transformExternalResourceToApiResource(mapping, ACCOUNT_SID, resource);
    expect(result).toMatchObject(expected);
  });

  test('Bug repro', () => {
    console.log(
      JSON.stringify(
        transformKhpResourceToApiResource('AC000', {
          nameDetails: {
            en: {
              alternate: 'alternate name 1',
              official: null,
            },
            fr: {
              alternate: 'alternate name 1 fr',
              official: null,
            },
          },
          applicationProcess: {
            en: 'application process',
            fr: 'application process fr',
          },
          capacity: {
            en: {
              type: 'capacity type',
              value: 'capacity value',
            },
            fr: {
              type: 'capacity type fr',
              value: 'capacity value fr',
            },
          },
          social: {
            facebook: 'facebook link',
            instagram: 'insta link',
            twitter: 'twitter link',
          },
          eligibilityDetails: {
            phrase: {
              fr: 'eligibility phrase fr',
              en: 'eligibility phrase',
            },
          },
          website: {
            en: null,
            fr: null,
          },
          metadata: {
            en: {
              availableForDirectory: 'true',
              availableForReferral: 'true',
              availableForResearch: 'false',
              fees: 'fees info',
              recordType: 'record type',
              typicalWaitTime: 'waiting time estimation',
              legalStatus: 'legal status',
              _id: '646e5007e997982f03739094',
              general: null,
            },
            fr: {
              availableForDirectory: 'true',
              availableForReferral: 'true',
              availableForResearch: 'false',
              fees: 'fees info',
              recordType: 'record type',
              typicalWaitTime: 'waiting time estimation',
              legalStatus: 'legal status',
              _id: '646e5007e997982f03739095',
              general: null,
            },
          },
          transportation: {
            en: null,
            fr: null,
          },
          seniorOrgContact: {
            title: {
              en: 'contact title',
              fr: 'contact title fr',
            },
            email: 'email',
            isPrivate: false,
            name: 'senior org contact name',
            phone: '4161111111',
          },
          khpReferenceNumber: 123123123,
          lastVerifiedOn: '2022-03-21T17:29:47.416Z',
          description: {
            en: 'description',
            fr: 'description fr',
            _id: '646e5007e997982f03739085',
          },
          isActive: true,
          name: {
            en: 'resource name',
            fr: 'resource name fr',
            _id: '646e5007e997982f03739086',
          },
          recordType: 'RAM',
          mailingAddresses: [],
          physicalAddresses: [
            {
              address1: 'address1',
              address2: 'address2',
              isPrivate: false,
              city: 'city',
              county: 'county',
              province: 'prvince',
              country: 'country',
              postalCode: 'postal code',
              description: 'description',
              longitude: 24,
              latitude: -92.3,
              _id: '646e5007e997982f03739087',
            },
          ],
          primaryLocationCity: 'primary city',
          primaryLocationCounty: 'primary county',
          primaryLocationPostalCode: 'primary postal code',
          primaryLocationPhone: 'primary phone',
          primaryLocationAddress1: 'primary address 1',
          primaryLocationAddress2: 'primary address 2',
          primaryLocationProvince: 'primary province',
          primaryLocationIsPrivate: true,
          coverage: [
            {
              en: 'coverage',
              fr: 'coverage fr',
              _id: '646e5007e997982f03739088',
            },
          ],
          targetPopulations: [
            {
              en: 'valueen',
              fr: 'valuefr',
              objectId: '6442ee0f802efc8a0b47245b',
            },
          ],
          eligibilityMinAge: 10,
          eligibilityMaxAge: 99,
          phoneNumbers: [
            {
              description: {
                en: 'description',
                fr: 'description fr',
              },
              type: 'phone',
              isPrivate: false,
              name: 'phone name',
              nameFR: null,
              number: '4161111111',
              _id: '646e5007e997982f03739089',
            },
          ],
          mainContact: {
            title: {
              en: 'contact title',
              fr: 'contact title fr',
            },
            email: 'email',
            isPrivate: false,
            name: 'contact name',
            phone: '4161111111',
            _id: '646e5007e997982f0373908a',
          },
          documentsRequired: [
            {
              en: 'documents required',
              fr: 'documents required fr',
              objectId: '6442ee0f802efc8a0b47245e',
            },
          ],
          operations: [
            {
              '0': {
                fr: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                en: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                _id: '646e5007e997982f0373908c',
              },
              '1': {
                fr: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                en: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                _id: '646e5007e997982f0373908d',
              },
              '2': {
                fr: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                en: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                _id: '646e5007e997982f0373908e',
              },
              '3': {
                fr: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                en: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                _id: '646e5007e997982f0373908f',
              },
              '4': {
                fr: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                en: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                _id: '646e5007e997982f03739090',
              },
              '5': {
                fr: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                en: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                _id: '646e5007e997982f03739091',
              },
              '6': {
                fr: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                en: {
                  day: 'day',
                  hoursOfOperation: 'hours of operation',
                  descriptionOfHours: 'description of hours',
                },
                _id: '646e5007e997982f03739092',
              },
              _id: '646e5007e997982f0373908b',
            },
          ],
          languages: [
            {
              code: 'en',
              language: 'english',
              _id: '646e5007e997982f03739093',
            },
          ],
          interpretationTranslationServicesAvailable: true,
          available247: true,
          feeStructureSourceFreeTextEn: null,
          feeStructureSourceFreeTextFr: null,
          feeStructureSource: [
            {
              en: 'valueen',
              fr: 'valuefr',
              objectId: '646e5007e997982f03739075',
            },
          ],
          howIsServiceOffered: [
            {
              en: 'valueen',
              fr: 'valuefr',
              objectId: '646e5007e997982f0373907d',
            },
          ],
          accessibility: {
            en: 'valueen',
            fr: 'valuefr',
            objectId: '6442ee0f802efc8a0b47246a',
          },
          howToAccessSupport: [
            {
              en: 'valueen',
              fr: 'valuefr',
              objectId: '646e5007e997982f03739079',
            },
          ],
          isHighlighted: true,
          keywords: ['keyword1', 'keyword2'],
          retiredAt: null,
          lastUpdatedBy: null,
          createdAt: '2023-05-24T17:57:27.765Z',
          updatedAt: '2023-05-24T17:57:27.765Z',
          objectId: '646e5007e997982f03739084',
          taxonomies: [
            [
              {
                code: 'code',
                nameEN: 'taxonomy sample',
                nameFR: 'taxonomy sample FR',
                level: 5,
                retiredAt: null,
                createdAt: '2023-05-24T17:57:27.741Z',
                updatedAt: '2023-05-24T17:57:27.741Z',
                objectId: '646e5007e997982f03739082',
              },
            ],
          ],
          notes: [
            {
              name:
                'Note from bulk upload - Wed May 24 2023 17:57:27 GMT+0000 (Coordinated Universal Time)',
              email: 'sample email1',
              phone: null,
              role: null,
              source: 'Bulk Upload-Wed May 24 2023 17:57:27 GMT+0000 (Coordinated Universal Time)',
              note: 'sample note 1',
              priority: null,
              createdAt: '2023-05-24T17:57:27.710Z',
              updatedAt: '2023-05-24T17:57:27.710Z',
              objectId: '646e5007e997982f03739065',
            },
            {
              name:
                'Note from bulk upload - Wed May 24 2023 17:57:27 GMT+0000 (Coordinated Universal Time)',
              email: 'sample email2',
              phone: null,
              role: null,
              source: 'Bulk Upload-Wed May 24 2023 17:57:27 GMT+0000 (Coordinated Universal Time)',
              note: 'sample note 2',
              priority: null,
              createdAt: '2023-05-24T17:57:27.712Z',
              updatedAt: '2023-05-24T17:57:27.712Z',
              objectId: '646e5007e997982f03739067',
            },
          ],
          verifications: [
            {
              name: 'verification name 1',
              title: 'title1',
              email: 'verification email1',
              phone: 'phone1',
              hasVerified: false,
              requestSent: false,
              createdAt: '2023-05-24T17:57:27.716Z',
              updatedAt: '2023-05-24T17:57:27.716Z',
              objectId: '646e5007e997982f0373906b',
            },
            {
              name: 'verification name 2',
              title: 'title2',
              email: 'verification email2',
              phone: 'phone2',
              hasVerified: false,
              requestSent: false,
              createdAt: '2023-05-24T17:57:27.717Z',
              updatedAt: '2023-05-24T17:57:27.717Z',
              objectId: '646e5007e997982f0373906d',
            },
          ],
          sites: [],
        }),
        null,
        2,
      ),
    );
  });
});
