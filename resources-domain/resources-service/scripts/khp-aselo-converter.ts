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

// eslint-disable-next-line import/no-extraneous-dependencies
import { parseISO } from 'date-fns';
import {
  AseloResource,
  AttributeTable,
  AttributeValue,
  InlineAttributeTable,
} from './aselo-resource';

export type FieldMappingContext = {
  currentValue?: any;
  captures: Record<string, string>;
  path: string[];
  rootResource: any;
};

type KhpResourceFieldMapping = {
  field: 'id' | 'name';
  valueGenerator: (context: FieldMappingContext) => any;
};
type KhpAttributeMapping<T extends AttributeTable> = {
  keyGenerator: (context: FieldMappingContext) => string;
  table: T;
  valueGenerator: (context: FieldMappingContext) => AttributeValue<T>;
  infoGenerator: (context: FieldMappingContext) => Record<string, any> | null;
};
type KhpInlineAttributeMapping<T extends InlineAttributeTable> = KhpAttributeMapping<T>;

type KhpTranslatableAttributeMapping = KhpAttributeMapping<'ResourceStringAttributes'> & {
  languageGenerator: (context: FieldMappingContext) => string;
};

type KhpReferenceAttributeMapping = KhpAttributeMapping<'ResourceReferenceStringAttributes'> & {
  list: string;
  languageGenerator: (context: FieldMappingContext) => string;
};

export type KhpMappingNode = {
  [key: string]: (
    | KhpResourceFieldMapping
    | KhpAttributeMapping<AttributeTable>
    | KhpReferenceAttributeMapping
    | {}
  ) & {
    children?: KhpMappingNode;
  };
};

const isKhpInlineAttributeMapping = <T extends InlineAttributeTable>(
  mapping: any,
): mapping is KhpInlineAttributeMapping<T> => {
  return (
    mapping &&
    mapping.table &&
    typeof mapping.keyGenerator === 'function' &&
    typeof mapping.valueGenerator === 'function' &&
    !mapping.list
  );
};

const isKhpTranslatableAttributeMapping = (
  mapping: any,
): mapping is KhpTranslatableAttributeMapping => {
  return (
    typeof mapping?.languageGenerator === 'function' &&
    isKhpInlineAttributeMapping<'ResourceStringAttributes'>(mapping)
  );
};

const isKhpReferenceAttributeMapping = (mapping: any): mapping is KhpReferenceAttributeMapping => {
  return (
    mapping &&
    mapping.table === 'ResourceReferenceStringAttributes' &&
    typeof mapping.keyGenerator === 'function' &&
    typeof mapping.valueGenerator === 'function' &&
    typeof mapping.list === 'string' &&
    mapping.list
  );
};

const isKhpResourceFieldMapping = (mapping: any): mapping is KhpResourceFieldMapping => {
  return mapping && mapping.field;
};

export const substitueCaptureTokens = (
  keyTemplate: string,
  context: FieldMappingContext,
): string => {
  return keyTemplate.replace(
    /{(?<captureToken>.*)}/g,
    (_, captureTokenProperty) => context.captures[captureTokenProperty],
  );
};

export const khpResourceFieldMapping = (
  field: 'id' | 'name',
  value?: (context: FieldMappingContext) => any,
): KhpResourceFieldMapping => ({
  field,
  valueGenerator: value || (context => context.currentValue),
});

export const khpAttributeMapping = <T extends AttributeTable>(
  table: T,
  key: string | ((context: FieldMappingContext) => string),
  {
    value = context => context.currentValue,
    info = () => null,
  }: {
    value?: AttributeValue<AttributeTable> | ((context: FieldMappingContext) => AttributeValue<T>);
    info?: (context: FieldMappingContext) => Record<string, any> | null;
  } = {},
): KhpAttributeMapping<AttributeTable> => ({
  table,
  keyGenerator: typeof key === 'function' ? key : context => substitueCaptureTokens(key, context),
  valueGenerator:
    typeof value === 'function'
      ? value
      : () =>
          table === 'ResourceDateTimeAttributes' && value && typeof value === 'string'
            ? parseISO(value)
            : value,
  infoGenerator: typeof info === 'function' ? info : () => info,
});

export const khpTranslatableAttributeMapping = (
  key: string | ((context: FieldMappingContext) => string),
  {
    value = context => context.currentValue,
    info = () => null,
    language = () => '',
  }: {
    value?: string | ((context: FieldMappingContext) => string);
    info?: (context: FieldMappingContext) => Record<string, any> | null;
    language?: string | ((context: FieldMappingContext) => string);
  } = {},
) => ({
  ...khpAttributeMapping('ResourceStringAttributes', key, { value, info }),
  languageGenerator: typeof language === 'function' ? language : () => language,
});

export const khpReferenceAttributeMapping = (
  key: string | ((context: FieldMappingContext) => string),
  list: string,
  data: {
    value?:
      | AttributeValue<'ResourceReferenceStringAttributes'>
      | ((context: FieldMappingContext) => AttributeValue<'ResourceReferenceStringAttributes'>);
    info?: (context: FieldMappingContext) => Record<string, any> | null;
    language?: string | ((context: FieldMappingContext) => string);
  } = {},
) => ({
  ...khpAttributeMapping('ResourceReferenceStringAttributes', key, data),
  languageGenerator: typeof data.language === 'function' ? data.language : () => data.language,
  list,
});

export const mapKHPResource = (
  resourceMapping: KhpMappingNode,
  khpResource: any,
): AseloResource => {
  const resource: AseloResource = {
    id: '',
    name: '',
    attributes: {
      ResourceStringAttributes: [],
      ResourceReferenceStringAttributes: [],
      ResourceBooleanAttributes: [],
      ResourceNumberAttributes: [],
      ResourceDateTimeAttributes: [],
    },
  };

  const mapNode = (
    mappingNode: KhpMappingNode,
    dataNode: any,
    parentContext: FieldMappingContext,
    aseloResource: AseloResource,
  ): AseloResource => {
    Object.entries(mappingNode).forEach(([property, { children, ...mapping }]) => {
      const captureProperty = property.match(/{(?<captureProperty>.*)}/)?.groups?.captureProperty;
      const dataProperties: string[] = (captureProperty ? Object.keys(dataNode) : [property])
        // Escape forward slashes in path segments
        .map(p => p.replace('/', '\\/'));
      dataProperties.forEach(dataProperty => {
        const dataPropertyValue = dataNode[dataProperty];
        const context: FieldMappingContext = {
          ...parentContext,
          currentValue: dataPropertyValue,
          path: [...parentContext.path, dataProperty],
        };
        if (captureProperty) {
          parentContext.captures[captureProperty] = dataProperty;
        }

        if (isKhpResourceFieldMapping(mapping)) {
          aseloResource[mapping.field] = mapping.valueGenerator(context);
        } else if (isKhpReferenceAttributeMapping(mapping)) {
          aseloResource.attributes.ResourceReferenceStringAttributes.push({
            key: mapping.keyGenerator(context),
            value: mapping.valueGenerator(context),
            language: mapping.languageGenerator(context),
            info: mapping.infoGenerator(context),
            list: mapping.list,
          });
        } else if (isKhpTranslatableAttributeMapping(mapping)) {
          aseloResource.attributes[mapping.table].push({
            key: mapping.keyGenerator(context),
            value: mapping.valueGenerator(context),
            language: mapping.languageGenerator(context),
            info: mapping.infoGenerator(context),
          } as any);
        } else if (isKhpInlineAttributeMapping(mapping)) {
          aseloResource.attributes[mapping.table].push({
            key: mapping.keyGenerator(context),
            value: mapping.valueGenerator(context),
            info: mapping.infoGenerator(context),
          } as any);
        }

        if (children) {
          mapNode(children, dataPropertyValue, context, aseloResource);
        }
      });
    });

    return aseloResource;
  };

  return mapNode(
    resourceMapping,
    khpResource,
    { captures: {}, path: [], rootResource: khpResource },
    resource,
  );
};
