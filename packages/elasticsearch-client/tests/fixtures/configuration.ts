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

import { CreateIndexConvertedDocument, IndexConfiguration, SearchConfiguration } from '../../src';
import { FlatResource, ReferrableResourceAttribute } from '@tech-matters/types/Resources';
import { IndicesCreateRequest } from '@elastic/elasticsearch/lib/api/types';
// eslint-disable-next-line prettier/prettier
import type { PropertyName, MappingProperty } from '@elastic/elasticsearch/lib/api/types';

/**
 * This is a C&P or the resources search configuration
 * TODO: Replace with a simplified test configuration
 */

export type MappingField = {
  type: 'integer' | 'keyword' | 'text' | 'boolean';
  hasLanguageFields?: boolean;
  isArrayField?: boolean;
  attributeKeyPattern?: RegExp;
  indexValueGenerator?: (attribute: ReferrableResourceAttribute<any>) => boolean | string | number;
};

export type ResourceIndexDocumentMappings = {
  highBoostGlobalFields: string[];
  mappingFields: {
    [key: string]: MappingField;
  };
  languageFields: Record<PropertyName, MappingProperty>
};

export type FieldAndMapping = {
  field: string;
  mapping: MappingField;
};

const stringFieldTypes = ['text', 'keyword'];

export const isMappingField = ({ mappingFields }: Pick<ResourceIndexDocumentMappings, 'mappingFields'>, fieldName: string) =>
  Object.keys(mappingFields).includes(fieldName);
export const isHighBoostGlobalField = ({ highBoostGlobalFields }: Pick<ResourceIndexDocumentMappings, 'highBoostGlobalFields'>, fieldName: string) =>
  highBoostGlobalFields.includes(fieldName);

export const isStringField = (fieldType: string): fieldType is 'keyword' | 'text' =>
  stringFieldTypes.includes(fieldType);


export const resourceIndexDocumentMappings: ResourceIndexDocumentMappings = {
  // This is a list of attribute names that should be given higher priority in search results.
  highBoostGlobalFields: ['description', 'province', 'city', 'targetPopulation', 'feeStructure'],

  mappingFields: {
    // TODO: this may change to a range field depending on discussion around what they really want to search for.
    // Is it likely that they want to put in a child age and find resources where the child age is between eligibilityMinAge and eligibilityMaxAge?
    // Having a range of ages and then passing in a range of ages to search for seems like a strange way to do it.
    eligibilityMinAge: {
      type: 'integer',
    },
    eligibilityMaxAge: {
      type: 'integer',
    },
    id: {
      type: 'keyword',
    },
    name: {
      type: 'keyword',
      hasLanguageFields: true,
    },
    feeStructure: {
      type: 'keyword',
    },
    targetPopulation: {
      type: 'keyword',
    },
    howIsServiceOffered: {
      type: 'keyword',
    },
    interpretationTranslationServicesAvailable: {
      type: 'boolean',
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
      attributeKeyPattern: /(.*)\/city$/,
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
  searchFields: [
    'name.*^4',
    'keywords.*^4',
    'high_boost_global.*^3',
    'low_boost_global.*^2',
    '*',
    '*.*',
  ],
};

export const resourceIndexConfiguration: IndexConfiguration<FlatResource> = {
  convertToIndexDocument: (resource: FlatResource): CreateIndexConvertedDocument => {
    const { mappingFields } = resourceIndexDocumentMappings;
    const mappedFields: { [key: string]: string | string[] | number | boolean } = {};
    const highBoostGlobal: string[] = [];
    const LowBoostGlobal: string[] = [];

    const pushToCorrectGlobalBoostField = (key: string, value: string) => {
      if (isHighBoostGlobalField(resourceIndexDocumentMappings, key)) {
        highBoostGlobal.push(value);
      } else {
        LowBoostGlobal.push(value);
      }
    };

    const pushToMappingField = (key: string, value: number | string | boolean) => {
      //TODO: I don't know what keywords field will actually look like should handle arrays here
      if (mappingFields![key].isArrayField) {
        if (!mappedFields[key]) {
          mappedFields[key] = [];
        }

        // TODO: not spending too much time on this, could we support multiple numbers in array mapped fields?
        const mapField = mappedFields[key] as string[];
        mapField.push(value.toString());
      } else {
        mappedFields[key] = typeof value === 'boolean' ? value.toString() : value;
      }
    };

    const parseAttribute = (
      key: string,
      { value }: ReferrableResourceAttribute<boolean | string | number>,
    ) => {
      if (isMappingField(resourceIndexDocumentMappings, key)) {
        return pushToMappingField(key, value);
      }
      // We don't really want booleans & numbers in the general purpose buckets
      if (typeof value === 'string') {
        pushToCorrectGlobalBoostField(key, value);
      }
    };

    const { id, name, lastUpdated, accountSid, ...attributeArrays } = resource;

    Object.values(attributeArrays).forEach(attributes => {
      attributes.forEach(({ key, ...attribute }) => {
        parseAttribute(key, attribute as any);
      });
    });

    return {
      name,
      high_boost_global: highBoostGlobal.join(' '),
      low_boost_global: LowBoostGlobal.join(' '),
      ...mappedFields,
    };
  },
  getCreateIndexParams: (index: string): IndicesCreateRequest => {
    const { mappingFields, languageFields } = resourceIndexDocumentMappings;
    const createRequest: IndicesCreateRequest = {
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
        },
      },
    };

    Object.entries(mappingFields).forEach(([key, value]) => {
      createRequest!.mappings!.properties![key] = {
        type: value.type,
      };

      if (!isStringField(value.type)) return;

      const property: any = createRequest!.mappings!.properties![key];
      property.copy_to = isHighBoostGlobalField(resourceIndexDocumentMappings, key)
        ? 'high_boost_global'
        : 'low_boost_global';

      if (value.hasLanguageFields) {
        property.fields = languageFields;
      }
    });

    return createRequest;
  },
};
