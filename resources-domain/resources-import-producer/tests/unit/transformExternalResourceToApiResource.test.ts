import { transformExternalResourceToApiResource } from '../../transformExternalResourceToApiResource';
import {
  MappingNode,
  resourceFieldMapping,
  attributeMapping,
  referenceAttributeMapping,
  translatableAttributeMapping,
} from '../../mappers';
import { ImportApiResource } from '@tech-matters/types';
import { KhpApiResource } from '../..';
import each from 'jest-each';

const startedDate = Date.now().toString();

describe('transformExternalResourceToApiResource - Simple mapping, flat structure', () => {
  const testCases: {
    description: string;
    mapping: MappingNode;
    resource: Partial<KhpApiResource>;
    expectedFromResource: (r: KhpApiResource) => ImportApiResource;
  }[] = [
    // Base case
    {
      description:
        'Node contains an empty value when we expected something to map, stop recursing (flat)',
      mapping: {
        attribute: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute'),
      },
      resource: {},
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // Top level resource
    {
      description: 'resourceFieldMapping on id, name and updatedAt',
      mapping: {
        khpReferenceNumber: resourceFieldMapping('id'),
        name: resourceFieldMapping('name', ctx => ctx.currentValue.en),
        updatedAt: resourceFieldMapping('updatedAt'),
      },
      resource: {
        name: { en: 'resource-1' },
        objectId: 'resource-1',
        updatedAt: startedDate,
        khpReferenceNumber: 'resource-1',
      },
      expectedFromResource: r => ({
        id: r.khpReferenceNumber,
        updatedAt: r.updatedAt,
        name: r.name.en,
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceBooleanAttributes
    {
      description: 'ResourceBooleanAttributes - no info',
      mapping: {
        attribute: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute'),
      },
      resource: {
        attribute: true,
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [
            {
              info: null,
              key: 'booleanAttribute',
              value: true,
            },
          ],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    {
      description: 'ResourceBooleanAttributes - with info',
      mapping: {
        attribute: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: true,
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [
            {
              info: { attribute: true },
              key: 'booleanAttribute',
              value: true,
            },
          ],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceStringAttributes
    {
      description: 'ResourceStringAttributes - no info',
      mapping: {
        attribute: attributeMapping('ResourceStringAttributes', 'stringAttribute'),
      },
      resource: {
        attribute: 'some string',
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [
            {
              language: null,
              info: null,
              key: 'stringAttribute',
              value: 'some string',
            },
          ],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    {
      description: 'ResourceStringAttributes - with info',
      mapping: {
        attribute: attributeMapping('ResourceStringAttributes', 'stringAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: 'some string',
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [
            {
              language: null,
              info: { attribute: 'some string' },
              key: 'stringAttribute',
              value: 'some string',
            },
          ],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // Translatable ResourceStringAttributes
    {
      description: 'TranslatableAttributeMapping - no info',
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
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [
            {
              language: 'en',
              info: null,
              key: 'translatableAttribute/en',
              value: 'some string',
            },
          ],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    {
      description: 'TranslatableAttributeMapping - with info',
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
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [
            {
              language: 'en',
              info: { attribute: 'some string' },
              key: 'translatableAttribute/en',
              value: 'some string',
            },
          ],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceNumberAttributes
    {
      description: 'ResourceNumberAttributes - no info',
      mapping: {
        attribute: attributeMapping('ResourceNumberAttributes', 'numberAttribute'),
      },
      resource: {
        attribute: 1,
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [
            {
              info: null,
              key: 'numberAttribute',
              value: 1,
            },
          ],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    {
      description: 'ResourceNumberAttributes - with info',
      mapping: {
        attribute: attributeMapping('ResourceNumberAttributes', 'numberAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: 1,
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [
            {
              info: { attribute: 1 },
              key: 'numberAttribute',
              value: 1,
            },
          ],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceDateTimeAttributes
    {
      description: 'ResourceDateTimeAttributes - no info',
      mapping: {
        attribute: attributeMapping('ResourceDateTimeAttributes', 'dateAttribute'),
      },
      resource: {
        attribute: startedDate,
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [
            {
              info: null,
              key: 'dateAttribute',
              value: startedDate,
            },
          ],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    {
      description: 'ResourceDateTimeAttributes - with info',
      mapping: {
        attribute: attributeMapping('ResourceDateTimeAttributes', 'dateAttribute', {
          info: ctx => ({ attribute: ctx.currentValue }),
        }),
      },
      resource: {
        attribute: startedDate,
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [
            {
              info: { attribute: startedDate },
              key: 'dateAttribute',
              value: startedDate,
            },
          ],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceReferenceStringAttributes
    {
      description: 'ResourceReferenceStringAttributes - no info',
      mapping: {
        attribute: referenceAttributeMapping('referenceAttribute', 'some-list', {
          value: ctx => ctx.currentValue.id,
        }),
      },
      resource: {
        attribute: { id: 'ref-id', value: 'reference value' },
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
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

describe('transformExternalResourceToApiResource - More mapping, nested structure', () => {
  const testCases: {
    description: string;
    mapping: MappingNode;
    resource: Partial<KhpApiResource>;
    expectedFromResource: (r: KhpApiResource) => ImportApiResource;
  }[] = [
    // Base case
    {
      description:
        'Node contains an empty value when we expected something to map, stop recursing (nested)',
      mapping: {
        attribute: {
          children: {
            nested: attributeMapping('ResourceBooleanAttributes', 'booleanAttribute'),
          },
        },
      },
      resource: {},
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // Top level resource
    {
      description: 'resourceFieldMapping on id, name and updatedAt',
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
      expectedFromResource: r => ({
        id: r.importantObject.id,
        updatedAt: r.importantObject.updatedAt,
        name: r.importantObject.name.en,
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceBooleanAttributes
    {
      description: 'ResourceBooleanAttributes',
      mapping: {
        booleans: {
          children: {
            '{proeprty}': attributeMapping('ResourceBooleanAttributes', '{proeprty}'),
          },
        },
      },
      resource: {
        booleans: {
          booleanAttribute1: true,
          booleanAttribute2: false,
        },
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
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
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceStringAttributes
    {
      description: 'ResourceStringAttributes',
      mapping: {
        strings: {
          children: {
            '{proeprty}': attributeMapping('ResourceStringAttributes', '{proeprty}'),
          },
        },
      },
      resource: {
        strings: {
          stringAttribute1: 'some string',
          stringAttribute2: 'another string',
        },
      },
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
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
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // Translatable ResourceStringAttributes
    {
      description: 'TranslatableAttributeMapping',
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
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
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
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceNumberAttributes
    {
      description: 'ResourceNumberAttributes',
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
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
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
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceDateTimeAttributes
    {
      description: 'ResourceDateTimeAttributes',
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
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
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
          ResourceReferenceStringAttributes: [],
        },
      }),
    },
    // ResourceReferenceStringAttributes
    {
      description: 'ResourceReferenceStringAttributes',
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
      expectedFromResource: () => ({
        id: '',
        updatedAt: '',
        name: '',
        attributes: {
          ResourceStringAttributes: [],
          ResourceNumberAttributes: [],
          ResourceBooleanAttributes: [],
          ResourceDateTimeAttributes: [],
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

  test('All together now! 🎵', async () => {
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
          '{proeprty}': attributeMapping('ResourceBooleanAttributes', '{proeprty}'),
        },
      },
      strings: {
        children: {
          '{proeprty}': attributeMapping('ResourceStringAttributes', '{proeprty}'),
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
