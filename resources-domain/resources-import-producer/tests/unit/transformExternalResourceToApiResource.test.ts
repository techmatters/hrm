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

import { transformExternalResourceToApiResource } from '../../transformExternalResourceToApiResource';
import {
  MappingNode,
  resourceFieldMapping,
  attributeMapping,
  referenceAttributeMapping,
  translatableAttributeMapping,
} from '../../mappers';
import { ImportApiResource } from '@tech-matters/types';
import each from 'jest-each';

const startedDate = Date.now().toString();

const mergeWithCleanResource = (
  partialResource: Omit<Partial<ImportApiResource>, 'attributes'> & {
    attributes?: Partial<ImportApiResource['attributes']>;
  } = {},
): ImportApiResource => ({
  ...{
    id: partialResource.id || '',
    updatedAt: partialResource.updatedAt || '',
    name: partialResource.name || '',
    attributes: {
      ResourceStringAttributes: partialResource.attributes?.ResourceStringAttributes || [],
      ResourceNumberAttributes: partialResource.attributes?.ResourceNumberAttributes || [],
      ResourceBooleanAttributes: partialResource.attributes?.ResourceBooleanAttributes || [],
      ResourceDateTimeAttributes: partialResource.attributes?.ResourceDateTimeAttributes || [],
      ResourceReferenceStringAttributes:
        partialResource.attributes?.ResourceReferenceStringAttributes || [],
    },
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
          '{key}': attributeMapping('ResourceStringAttributes', '{key}'),
        },
      },
    };

    const expected: ImportApiResource = mergeWithCleanResource({
      attributes: {
        ResourceStringAttributes: [
          {
            key: 'key1',
            value: 'value 1',
            info: null,
            language: null,
          },
          {
            key: 'key2',
            value: 'value 2',
            info: null,
            language: null,
          },
        ],
      },
    });

    const result = transformExternalResourceToApiResource(mapping, resource);
    expect(result).toMatchObject(expected);
  });

  test('Mapping an attribute with dynamica and static capture - should capture only the non-static keys', async () => {
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
          another: attributeMapping('ResourceBooleanAttributes', 'another'),
          '{key}': attributeMapping('ResourceStringAttributes', '{key}'),
        },
      },
    };

    const expected: ImportApiResource = mergeWithCleanResource({
      attributes: {
        ResourceStringAttributes: [
          {
            key: 'key1',
            value: 'value 1',
            info: null,
            language: null,
          },
          {
            key: 'key2',
            value: 'value 2',
            info: null,
            language: null,
          },
        ],
        ResourceBooleanAttributes: [
          {
            key: 'another',
            value: true,
            info: null,
          },
        ],
      },
    });

    const result = transformExternalResourceToApiResource(mapping, resource);
    expect(result).toMatchObject(expected);
  });
});

describe('Simple mappings with flat structure', () => {
  const testCases: {
    description: string;
    mapping: MappingNode;
    resource: Record<string, any>;
    expectedFromResource: (r: Record<string, any>) => ImportApiResource;
  }[] = [
    // Base case
    {
      description:
        'when node contains empty value and is expecteded something to map,  should stop recursing',
      mapping: {
        attribute: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute'),
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
        updatedAt: resourceFieldMapping('updatedAt'),
      },
      resource: {
        name: { en: 'resource-1' },
        objectId: 'resource-1',
        updatedAt: startedDate,
      },
      expectedFromResource: r =>
        mergeWithCleanResource({
          id: r.objectId,
          updatedAt: r.updatedAt,
          name: r.name.en,
        }),
    },
    // ResourceBooleanAttributes
    {
      description:
        'when mapping ResourceBooleanAttributes without info property - should add ResourceBooleanAttributes record with null info',
      mapping: {
        attribute: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute'),
      },
      resource: {
        attribute: true,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceBooleanAttributes: [
              {
                info: null,
                key: 'booleanAttribute',
                value: true,
              },
            ],
          },
        }),
    },
    {
      description:
        'when mapping ResourceBooleanAttributes with info property - should add ResourceBooleanAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: true,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceBooleanAttributes: [
              {
                info: { attribute: true },
                key: 'booleanAttribute',
                value: true,
              },
            ],
          },
        }),
    },
    // ResourceStringAttributes
    {
      description:
        'when mapping ResourceStringAttributes without info property - should add ResourceStringAttributes record with null info',
      mapping: {
        attribute: attributeMapping('ResourceStringAttributes', 'stringAttribute'),
      },
      resource: {
        attribute: 'some string',
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceStringAttributes: [
              {
                language: null,
                info: null,
                key: 'stringAttribute',
                value: 'some string',
              },
            ],
          },
        }),
    },
    {
      description:
        'when mapping ResourceStringAttributes with info property - should add ResourceStringAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('ResourceStringAttributes', 'stringAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: 'some string',
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceStringAttributes: [
              {
                language: null,
                info: { attribute: 'some string' },
                key: 'stringAttribute',
                value: 'some string',
              },
            ],
          },
        }),
    },
    // Translatable ResourceStringAttributes
    {
      description:
        'when mapping Translatable ResourceStringAttributes without info property - should add Translatable ResourceStringAttributes record with null info',
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
          attributes: {
            ResourceStringAttributes: [
              {
                language: 'en',
                info: null,
                key: 'translatableAttribute/en',
                value: 'some string',
              },
            ],
          },
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
          attributes: {
            ResourceStringAttributes: [
              {
                language: 'en',
                info: { attribute: 'some string' },
                key: 'translatableAttribute/en',
                value: 'some string',
              },
            ],
          },
        }),
    },
    // ResourceNumberAttributes
    {
      description:
        'when mapping ResourceNumberAttributes without info property - should add ResourceNumberAttributes record with null info',
      mapping: {
        attribute: attributeMapping('ResourceNumberAttributes', 'numberAttribute'),
      },
      resource: {
        attribute: 1,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceNumberAttributes: [
              {
                info: null,
                key: 'numberAttribute',
                value: 1,
              },
            ],
          },
        }),
    },
    {
      description:
        'when mapping ResourceNumberAttributes with info property - should add ResourceNumberAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('ResourceNumberAttributes', 'numberAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: 1,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceNumberAttributes: [
              {
                info: { attribute: 1 },
                key: 'numberAttribute',
                value: 1,
              },
            ],
          },
        }),
    },
    // ResourceDateTimeAttributes
    {
      description:
        'when mapping ResourceDateTimeAttributes without info property - should add ResourceDateTimeAttributes record with null info',
      mapping: {
        attribute: attributeMapping('ResourceDateTimeAttributes', 'dateAttribute'),
      },
      resource: {
        attribute: startedDate,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceDateTimeAttributes: [
              {
                info: null,
                key: 'dateAttribute',
                value: startedDate,
              },
            ],
          },
        }),
    },
    {
      description:
        'when mapping ResourceDateTimeAttributes with info property - should add ResourceDateTimeAttributes record with populated info',
      mapping: {
        attribute: attributeMapping('ResourceDateTimeAttributes', 'dateAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: startedDate,
      },
      expectedFromResource: () =>
        mergeWithCleanResource({
          attributes: {
            ResourceDateTimeAttributes: [
              {
                info: { attribute: startedDate },
                key: 'dateAttribute',
                value: startedDate,
              },
            ],
          },
        }),
    },
    // ResourceReferenceStringAttributes
    {
      description:
        'when mapping ResourceReferenceStringAttributes - should add ResourceReferenceStringAttributes record',
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
          attributes: {
            ResourceReferenceStringAttributes: [
              {
                language: null,
                key: 'referenceAttribute',
                value: 'ref-id',
                list: 'some-list',
              },
            ],
          },
        }),
    },
  ];

  each(testCases).test('$description', async ({ mapping, resource, expectedFromResource }) => {
    const expected = expectedFromResource(resource);
    const result = transformExternalResourceToApiResource(mapping, resource);
    expect(result).toMatchObject(expected);
  });
});

describe('Simple mapping, nested structure', () => {
  const testCases: {
    description: string;
    mapping: MappingNode;
    resource: Record<string, any>;
    expectedFromResource: (r: Record<string, any>) => ImportApiResource;
  }[] = [
    // Base case
    {
      description:
        'when node contains empty value and is expecteded something to map,  should stop recursing',
      mapping: {
        attribute: {
          children: {
            nested: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute'),
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
            updatedAt: resourceFieldMapping('updatedAt'),
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
          updatedAt: r.importantObject.updatedAt,
          name: r.importantObject.name.en,
        }),
    },
    // ResourceBooleanAttributes
    {
      description:
        'when mapping ResourceBooleanAttributes without info property - should add ResourceBooleanAttributes records with null info',
      mapping: {
        booleans: {
          children: {
            '{property}': attributeMapping('ResourceBooleanAttributes', '{property}'),
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
          attributes: {
            ResourceBooleanAttributes: [
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
          },
        }),
    },
    // ResourceStringAttributes
    {
      description:
        'when mapping ResourceStringAttributes without info property - should add ResourceStringAttributes records with null info',
      mapping: {
        strings: {
          children: {
            '{property}': attributeMapping('ResourceStringAttributes', '{property}'),
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
          attributes: {
            ResourceStringAttributes: [
              {
                language: null,
                info: null,
                key: 'stringAttribute1',
                value: 'some string',
              },
              {
                language: null,
                info: null,
                key: 'stringAttribute2',
                value: 'another string',
              },
            ],
          },
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
          attributes: {
            ResourceStringAttributes: [
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
          },
        }),
    },
    // ResourceNumberAttributes
    {
      description:
        'when mapping ResourceNumberAttributes without info property - should add ResourceNumberAttributes records with null info',
      mapping: {
        numbers: {
          children: {
            '{property}': attributeMapping('ResourceNumberAttributes', '{property}'),
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
          attributes: {
            ResourceNumberAttributes: [
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
          },
        }),
    },
    // ResourceDateTimeAttributes
    {
      description:
        'when mapping ResourceDateTimeAttributes without info property - should add ResourceDateTimeAttributes records with null info',
      mapping: {
        dates: {
          children: {
            '{property}': attributeMapping('ResourceDateTimeAttributes', '{property}'),
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
          attributes: {
            ResourceDateTimeAttributes: [
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
          },
        }),
    },
    // ResourceReferenceStringAttributes
    {
      description:
        'when mapping ResourceReferenceStringAttributes without info property - should add ResourceReferenceStringAttributes records with null info',
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
          attributes: {
            ResourceReferenceStringAttributes: [
              {
                language: null,
                key: 'referenceAttribute1',
                value: 'ref-1',
                list: 'some-list',
              },
              {
                language: null,
                key: 'referenceAttribute2',
                value: 'ref-2',
                list: 'some-list',
              },
            ],
          },
        }),
    },
  ];

  each(testCases).test('$description', async ({ mapping, resource, expectedFromResource }) => {
    const expected = expectedFromResource(resource);
    const result = transformExternalResourceToApiResource(mapping, resource);
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
          updatedAt: resourceFieldMapping('updatedAt'),
        },
      },
      booleans: {
        children: {
          '{property}': attributeMapping('ResourceBooleanAttributes', '{property}'),
        },
      },
      strings: {
        children: {
          '{property}': attributeMapping('ResourceStringAttributes', '{property}'),
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
          '{property}': attributeMapping('ResourceNumberAttributes', '{property}'),
        },
      },
      dates: {
        children: {
          '{property}': attributeMapping('ResourceDateTimeAttributes', '{property}'),
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

    const expected: ImportApiResource = {
      id: resource.importantObject.id,
      updatedAt: resource.importantObject.updatedAt,
      name: resource.importantObject.name.en,
      attributes: {
        ResourceBooleanAttributes: [
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
        ResourceStringAttributes: [
          {
            language: null,
            info: null,
            key: 'stringAttribute1',
            value: 'some string',
          },
          {
            language: null,
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
        ResourceNumberAttributes: [
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
        ResourceDateTimeAttributes: [
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
        ResourceReferenceStringAttributes: [
          {
            language: null,
            key: 'referenceAttribute1',
            value: 'ref-1',
            list: 'some-list',
          },
          {
            language: null,
            key: 'referenceAttribute2',
            value: 'ref-2',
            list: 'some-list',
          },
        ],
      },
    };

    const result = transformExternalResourceToApiResource(mapping, resource);
    expect(result).toMatchObject(expected);
  });
});
