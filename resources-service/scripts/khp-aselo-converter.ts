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
  languageGenerator: (context: FieldMappingContext) => string;
};
type KhpInlineAttributeMapping<T extends InlineAttributeTable> = KhpAttributeMapping<T>;
type KhpReferenceAttributeMapping = KhpAttributeMapping<'ResourceReferenceStringAttributes'> & {
  list: string;
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
    language = () => '',
  }: {
    value?: AttributeValue<AttributeTable> | ((context: FieldMappingContext) => AttributeValue<T>);
    info?: (context: FieldMappingContext) => Record<string, any> | null;
    language?: string | ((context: FieldMappingContext) => string);
  } = {},
): KhpAttributeMapping<AttributeTable> => ({
  table,
  keyGenerator: typeof key === 'function' ? key : context => substitueCaptureTokens(key, context),
  valueGenerator:
    typeof value === 'function'
      ? value
      : () =>
          table === 'ResourceDateAttributes' && value && typeof value === 'string'
            ? parseISO(value)
            : value,
  infoGenerator: typeof info === 'function' ? info : () => info,
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
      ResourceDateAttributes: [],
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
        } else if (isKhpInlineAttributeMapping(mapping)) {
          aseloResource.attributes[mapping.table].push({
            key: mapping.keyGenerator(context),
            value: mapping.valueGenerator(context),
            language: mapping.languageGenerator(context),
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
