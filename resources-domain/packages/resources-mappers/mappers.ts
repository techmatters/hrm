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
  AttributeProperty,
  AttributeValue,
  InlineAttributeProperty,
} from '@tech-matters/resources-types';
import parseISO from 'date-fns/parseISO';

/**
 * A mapping context provides information about the current attribute being processed.
 * It is consumed when recursively generating the nested attributes related to a resource.
 */
export type FieldMappingContext = {
  currentValue?: any;
  parentValue?: any;
  captures: Record<string, string>;
  path: string[];
  rootResource: any;
};

type ContextConsumerFunc<T> = (context: FieldMappingContext) => T;
type ValueOrContextConsumerFunc<T> = T | ContextConsumerFunc<T>;

const isContextConsumerFunc = <T>(
  fun: ValueOrContextConsumerFunc<T>,
): fun is ContextConsumerFunc<T> => {
  return typeof fun === 'function';
};

/**
 * Maps the only properties of a resource that belong to the resources table: id and name. Any other property will be mapped into one of the attributes tables.
 */
export type ResourceFieldMapping = {
  field: 'id' | 'name' | 'lastUpdated' | 'deletedAt' | 'importSequenceId';
  valueGenerator: ContextConsumerFunc<any>;
};

/**
 * Maps a resource attribute to the corresponding AttributeProperty.
 * The next types are refinements on this one to specify the context needed to map to the refined AttributeProperty
 */
// type AttributeMapping<T extends AttributeProperty> = {
type AttributeMapping<T extends AttributeProperty> = {
  property: T;
  keyGenerator: ContextConsumerFunc<string>;
  valueGenerator: ContextConsumerFunc<AttributeValue<T>>;
  infoGenerator: ContextConsumerFunc<Record<string, any> | null>;
};

export type InlineAttributeMapping<T extends InlineAttributeProperty> =
  AttributeMapping<T>;

export type TranslatableAttributeMapping = AttributeMapping<'stringAttributes'> & {
  languageGenerator: ContextConsumerFunc<string>;
};

export type ReferenceAttributeMapping = Omit<
  AttributeMapping<'referenceStringAttributes'>,
  'infoGenerator'
> & {
  list: string;
  languageGenerator: ContextConsumerFunc<string>;
};

export const isResourceFieldMapping = (mapping: any): mapping is ResourceFieldMapping => {
  return mapping && mapping.field;
};

export const isInlineAttributeMapping = <T extends InlineAttributeProperty>(
  mapping: any,
): mapping is InlineAttributeMapping<T> => {
  return (
    mapping &&
    mapping.property &&
    typeof mapping.keyGenerator === 'function' &&
    typeof mapping.valueGenerator === 'function' &&
    !mapping.list
  );
};

export const isReferenceAttributeMapping = (
  mapping: any,
): mapping is ReferenceAttributeMapping => {
  return (
    mapping &&
    mapping.property === 'referenceStringAttributes' &&
    typeof mapping.keyGenerator === 'function' &&
    typeof mapping.valueGenerator === 'function' &&
    typeof mapping.list === 'string' &&
    mapping.list
  );
};

export const isTranslatableAttributeMapping = (
  mapping: any,
): mapping is TranslatableAttributeMapping => {
  return (
    typeof mapping?.languageGenerator === 'function' &&
    isInlineAttributeMapping<'stringAttributes'>(mapping)
  );
};

export type ResourceMapping =
  | ResourceFieldMapping
  | AttributeMapping<AttributeProperty>
  | ReferenceAttributeMapping;

type ResourceMappingList = {
  mappings: ResourceMapping[];
};

export const isResourceMappingList = (mapping: any): mapping is ResourceMappingList => {
  return mapping && Array.isArray(mapping.mappings);
};

/**
 * A node is a single item to be mapped into one of the above possible types.
 * If the node contains "children", it means we want to recurse on them.
 */
export type MappingNode = {
  [key: string]: (ResourceMapping | { mappings: ResourceMapping[] } | {}) & {
    children?: MappingNode;
  };
};

export const substituteCaptureTokens = (
  keyTemplate: string,
  context: FieldMappingContext,
): string => {
  return keyTemplate.replace(
    /{(?<captureToken>.+?)}/g,
    (_, captureTokenProperty) => context.captures[captureTokenProperty],
  );
};

export const resourceFieldMapping = (
  field: 'id' | 'name' | 'lastUpdated' | 'deletedAt' | 'importSequenceId',
  value?: ContextConsumerFunc<string>, // can we refine this type?
): ResourceFieldMapping => ({
  field,
  valueGenerator: value || (context => context.currentValue),
});

export const attributeMapping = <T extends AttributeProperty>(
  property: T,
  key: ValueOrContextConsumerFunc<string>,
  {
    value = context => context.currentValue,
    info = () => null,
  }: {
    value?: ValueOrContextConsumerFunc<AttributeValue<T>>;
    info?: ContextConsumerFunc<Record<string, any> | null>;
  } = {},
): AttributeMapping<AttributeProperty> => ({
  property,
  keyGenerator:
    typeof key === 'function' ? key : context => substituteCaptureTokens(key, context),
  valueGenerator:
    typeof value === 'function'
      ? value
      : () => {
          if (property === 'dateTimeAttributes' && value && typeof value === 'string') {
            return parseISO(value).toString();
          }

          if (typeof value === 'string') {
            return value?.trim();
          }

          return value;
        },
  infoGenerator: typeof info === 'function' ? info : () => info,
});

export const translatableAttributeMapping = (
  key: ValueOrContextConsumerFunc<string>,
  {
    value = context => context.currentValue,
    info = () => null,
    language,
  }: {
    value?: ValueOrContextConsumerFunc<string>;
    info?: ContextConsumerFunc<Record<string, any> | null>;
    language?: ValueOrContextConsumerFunc<string>;
  } = {},
): TranslatableAttributeMapping => {
  const mappingResult = attributeMapping('stringAttributes', key, {
    value,
    info,
  });

  // This case should be impossible but we gotta help TS
  if (!isInlineAttributeMapping<'stringAttributes'>(mappingResult)) {
    throw new Error(
      `Panic! mappingResult is not InlineAttributeMapping<ResourceStringAttributes>: ${mappingResult}`,
    );
  }

  return {
    ...mappingResult,
    languageGenerator: typeof language === 'function' ? language : () => language ?? '',
  };
};

export const referenceAttributeMapping = (
  key: ValueOrContextConsumerFunc<string>,
  list: string,
  data: {
    value: ValueOrContextConsumerFunc<AttributeValue<'referenceStringAttributes'>>;
    language?: ValueOrContextConsumerFunc<string>;
  },
): ReferenceAttributeMapping => {
  const { infoGenerator, ...mappingResult } = attributeMapping(
    'referenceStringAttributes',
    key,
    data,
  );

  const mapping = {
    ...mappingResult,
    list,
  };
  // This case should be impossible but we gotta help TS
  if (!isReferenceAttributeMapping(mapping)) {
    throw new Error(
      `Panic! mappingResult is not ReferenceAttributeMapping: ${mappingResult}`,
    );
  }

  if (isContextConsumerFunc(data.language)) {
    return {
      ...mapping,
      languageGenerator: data.language,
    };
  }

  const languageGeneratorResult = data.language || '';

  return {
    ...mapping,
    languageGenerator: () => languageGeneratorResult,
  };
};
