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

import type {
  FlatResource,
  ReferrableResourceAttribute,
} from '@tech-matters/resources-types/Resources';
import { IndicesCreateRequest } from '@elastic/elasticsearch/lib/api/types';
import type { MappingProperty, PropertyName } from '@elastic/elasticsearch/lib/api/types';

import {
  CreateIndexConvertedDocument,
  IndexConfiguration,
  SearchConfiguration,
} from '../../src';

/**
 * This is almost a a C&P or the resources search configuration
 * TODO: Replace with a simplified test configuration
 */

export type MappingField = {
  type: 'integer' | 'keyword' | 'text' | 'boolean';
  hasLanguageFields?: boolean;
  isArrayField?: boolean;
  attributeKeyPattern?: RegExp;
  indexValueGenerator?: (
    attribute: ReferrableResourceAttribute<any>,
  ) => boolean | string | number;
};

export type ResourceIndexDocumentMappings = {
  highBoostGlobalFields: string[];
  mappingFields: {
    [key: string]: MappingField;
  };
  languageFields: Record<PropertyName, MappingProperty>;
};

export type FieldAndMapping = {
  field: string;
  mapping: MappingField;
};

const stringFieldTypes = ['text', 'keyword'];

export const getMappingField = (
  { mappingFields }: Pick<ResourceIndexDocumentMappings, 'mappingFields'>,
  fieldName: string,
): FieldAndMapping | undefined => {
  if (Object.keys(mappingFields).includes(fieldName))
    return { field: fieldName, mapping: mappingFields[fieldName] };
  const [field, mapping] =
    Object.entries(mappingFields).find(
      ([, { attributeKeyPattern }]) => attributeKeyPattern?.test(fieldName),
    ) ?? [];
  return mapping && field ? { field, mapping } : undefined;
};

export const isHighBoostGlobalField = (
  { highBoostGlobalFields }: Pick<ResourceIndexDocumentMappings, 'highBoostGlobalFields'>,
  fieldName: string,
) => highBoostGlobalFields.includes(fieldName);

export const isStringField = (fieldType: string): fieldType is 'keyword' | 'text' =>
  stringFieldTypes.includes(fieldType);

export const resourceIndexDocumentMappings: ResourceIndexDocumentMappings = {
  // This is a list of attribute names that should be given higher priority in search results.
  highBoostGlobalFields: ['description', 'city'],

  mappingFields: {
    // TODO: this may change to a range field depending on discussion around what they really want to search for.
    // Is it likely that they want to put in a child age and find resources where the child age is between eligibilityMinAge and eligibilityMaxAge?
    // Having a range of ages and then passing in a range of ages to search for seems like a strange way to do it.

    name: {
      type: 'keyword',
      hasLanguageFields: true,
    },
    feeStructure: {
      type: 'keyword',
    },
    province: {
      type: 'keyword',
      isArrayField: true,
      attributeKeyPattern: /(.*)\/province$/,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        `${info?.name ?? ''} ${value}`,
    },
    city: {
      type: 'keyword',
      isArrayField: true,
      indexValueGenerator: ({ value, info }: ReferrableResourceAttribute<string>) =>
        `${info?.name ?? ''} ${value}`,
    },
  },
  languageFields: {
    en: {
      type: 'text',
      analyzer: 'rebuilt_english',
    },
    fr: {
      type: 'text',
      analyzer: 'rebuilt_french',
    },
  },
};

export const resourceSearchConfiguration: SearchConfiguration = {
  searchFieldBoosts: {
    'name.*': 4,
    'high_boost_global.*': 3,
    'low_boost_global.*': 2,
    '*': 1,
    '*.*': 1,
  },
  filterMappings: {},
};

export const resourceIndexConfiguration: IndexConfiguration<FlatResource> = {
  convertToIndexDocument: (
    resource: FlatResource,
  ): CreateIndexConvertedDocument<{
    [key: string]: string | string[] | number | boolean;
  }> => {
    const { mappingFields } = resourceIndexDocumentMappings;
    const mappedFields: { [key: string]: string | string[] | number | boolean } = {};
    const highBoostGlobal: string[] = [];
    const lowBoostGlobal: string[] = [];

    const pushToCorrectGlobalBoostField = (key: string, value: string) => {
      if (isHighBoostGlobalField(resourceIndexDocumentMappings, key)) {
        highBoostGlobal.push(value);
      } else {
        lowBoostGlobal.push(value);
      }
    };

    const pushValueToMappedField = (
      { field, mapping }: FieldAndMapping,
      value: boolean | string | number,
    ) => {
      if (mapping.isArrayField) {
        if (!mappedFields[field]) {
          mappedFields[field] = [];
        }

        const mapField = mappedFields[field] as (typeof value)[];
        mapField.push(value);
      } else {
        if (mapping.hasLanguageFields) {
          console.warn(
            `Possible misconfiguration - mapping field '${field}' has the hasLanguageFields flag set but not the isArrayField: a multi-language field should normally be an array, otherwise the languages for different languages will be overwrite each other.`,
          );
        }
        mappedFields[field] = value;
      }
    };

    const parseAttribute = (
      key: string,
      attribute: ReferrableResourceAttribute<boolean | string | number>,
    ) => {
      const fieldAndMapping = getMappingField(resourceIndexDocumentMappings, key);
      if (fieldAndMapping) {
        return pushValueToMappedField(
          fieldAndMapping,
          fieldAndMapping.mapping.indexValueGenerator?.(attribute) ?? attribute.value,
        );
      }
      // We don't really want booleans & numbers in the general purpose buckets
      if (typeof attribute.value === 'string') {
        pushToCorrectGlobalBoostField(key, attribute.value);
      }
    };

    const {
      id,
      name,
      lastUpdated,
      accountSid,
      importSequenceId,
      deletedAt,
      ...attributeArrays
    } = resource;

    Object.values(attributeArrays).forEach(attributes => {
      attributes.forEach(({ key, ...attribute }) => {
        parseAttribute(key, attribute as any);
      });
    });
    pushValueToMappedField({ field: 'name', mapping: mappingFields.name }, name);

    const doc = {
      id,
      name,
      high_boost_global: highBoostGlobal.join(' '),
      low_boost_global: lowBoostGlobal.join(' '),
      ...mappedFields,
    };
    console.debug('Indexing document: ', doc);
    return doc;
  },
  getCreateIndexParams: (index: string): IndicesCreateRequest => {
    const { languageFields } = resourceIndexDocumentMappings;
    return {
      index,
      settings: {
        analysis: {
          filter: {
            english_stemmer: {
              type: 'stemmer',
              language: 'english',
            },
            french_stemmer: {
              type: 'stemmer',
              language: 'french',
            },
          },
          analyzer: {
            rebuilt_english: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'english_stemmer'],
            },
            rebuilt_french: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'french_stemmer'],
            },
          },
        },
      },
      mappings: {
        properties: {
          high_boost_global: {
            type: 'text',
            fields: languageFields,
          },
          low_boost_global: {
            type: 'text',
            fields: languageFields,
          },
          name: {
            type: 'text',
            fields: languageFields,
            copy_to: 'high_boost_global',
          },
          name_completion: {
            type: 'completion',
          },
          id: {
            type: 'text',
            copy_to: 'high_boost_global',
          },
          city: {
            type: 'text',
            copy_to: 'low_boost_global',
          },
        },
      },
    };
  },
};
