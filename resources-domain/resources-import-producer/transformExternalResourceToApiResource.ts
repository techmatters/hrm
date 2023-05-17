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

// eslint-disable-next-line prettier/prettier
import type { ImportApiResource, InlineAttributeTable } from '@tech-matters/types';
import { KhpApiResource } from '.';
import {
  FieldMappingContext,
  InlineAttributeMapping,
  MappingNode,
  ReferenceAttributeMapping,
  ResourceFieldMapping,
  TranslatableAttributeMapping,
  isInlineAttributeMapping,
  isReferenceAttributeMapping,
  isResourceFieldMapping,
  isTranslatableAttributeMapping,
} from './mappers';
import mappings from './mappings';

const pushResourceFieldMapping = ({ aseloResource, context, mapping }: {
  mapping: Omit<ResourceFieldMapping, 'children'>, 
  aseloResource: ImportApiResource,
  context: FieldMappingContext
}): void => {
  aseloResource[mapping.field] = mapping.valueGenerator(context);
};

const pushReferenceAttributeMapping = ({ aseloResource, context, mapping }: {
  mapping: Omit<ReferenceAttributeMapping, 'children'>, 
  aseloResource: ImportApiResource,
  context: FieldMappingContext
}): void => {
  aseloResource.attributes.ResourceReferenceStringAttributes.push({
    key: mapping.keyGenerator(context),
    value: mapping.valueGenerator(context),
    language: mapping.languageGenerator(context),
    list: mapping.list,
  });
};

const pushTranslatableAttributeMapping = ({ aseloResource, context, mapping }: {
  mapping: Omit<TranslatableAttributeMapping, 'children'>, 
  aseloResource: ImportApiResource,
  context: FieldMappingContext
}): void => {
  aseloResource.attributes[mapping.table].push({
    key: mapping.keyGenerator(context),
    value: mapping.valueGenerator(context),
    language: mapping.languageGenerator(context),
    info: mapping.infoGenerator(context),
  });
};

const pushInlineAttributeMapping = <T extends InlineAttributeTable>({ aseloResource, context, mapping }: {
  mapping: Omit<InlineAttributeMapping<T>, 'children'>, 
  aseloResource: ImportApiResource,
  context: FieldMappingContext
}): void => {
  if (mapping.table === 'ResourceStringAttributes') {
    const value = mapping.valueGenerator(context);
    if (typeof value !== 'string') {
      throw new Error(`Wrong value provided to ResourceStringAttributes: mapping ${JSON.stringify(mapping)} and value ${value}`);
    }

    aseloResource.attributes.ResourceStringAttributes.push({
      key: mapping.keyGenerator(context),
      value,
      info: mapping.infoGenerator(context),
      language: null,
    });
  } else if (mapping.table === 'ResourceBooleanAttributes') {
    const value = mapping.valueGenerator(context);
    if (typeof value !== 'boolean') {
      throw new Error(`Wrong value provided to ResourceBooleanAttributes: mapping ${JSON.stringify(mapping)} and value ${value}`);
    }

    aseloResource.attributes.ResourceBooleanAttributes.push({
      key: mapping.keyGenerator(context),
      value,
      info: mapping.infoGenerator(context),
    });
  } else if (mapping.table ===  'ResourceNumberAttributes') {
    const value = mapping.valueGenerator(context);
    if (typeof value !== 'number') {
      throw new Error(`Wrong value provided to ResourceNumberAttributes: mapping ${JSON.stringify(mapping)} and value ${value}`);
    }

    aseloResource.attributes.ResourceNumberAttributes.push({
      key: mapping.keyGenerator(context),
      value,
      info: mapping.infoGenerator(context),
    });
  } else if (mapping.table === 'ResourceDateTimeAttributes') {
    const value = mapping.valueGenerator(context);
    if (typeof value !== 'string') {
      throw new Error(`Wrong value provided to ResourceDateTimeAttributes: mapping ${JSON.stringify(mapping)} and value ${value}`);
    }

    aseloResource.attributes.ResourceDateTimeAttributes.push({
      key: mapping.keyGenerator(context),
      value,
      info: mapping.infoGenerator(context),
    });
  } else {
    throw new Error(`Unhandled case for provided mapping: mapping ${JSON.stringify(mapping)}`);
  }
};

/**
 * Function to map a KHP node into an Aselo resource.
 * This function mutates the given resource.
 * Recusively transform the children (if any).
 * @param mappingNode
 * @param dataNode
 * @param parentContext
 * @param aseloResource
 * @returns
 */
const mapNode = (
  mappingNode: MappingNode,
  dataNode: any,
  parentContext: FieldMappingContext,
  aseloResource: ImportApiResource,
): ImportApiResource => {
  Object.entries(mappingNode).forEach(([property, { children, ...mapping }]) => {
    const captureProperty = property.match(/{(?<captureProperty>.*)}/)?.groups?.captureProperty;
    console.log(captureProperty);
    console.log(dataNode);
    console.log(mappingNode);

    // If there are sibling keys to the dynamic capture, treat them as static
    const { [`{${captureProperty}}`]: capturePropertyMapping, ...staticMappings } = captureProperty ? mappingNode : {};
    const staticKeys = Object.keys(staticMappings);
    const rawDataProperties = captureProperty 
    ? Object.keys(dataNode).filter(k => !staticKeys.includes(k)) 
    : [property];

    const dataProperties: string[] = rawDataProperties
      // Escape forward slashes in path segments
      .map(p => p.replace('/', '\\/'));
    dataProperties.forEach(dataProperty => {
      const dataPropertyValue = dataNode[dataProperty];

      // Node contains an empty value when we expected something to map, stop recursing
      if (dataPropertyValue === null || dataPropertyValue === undefined) {
        return;
      }

      const context: FieldMappingContext = {
        ...parentContext,
        currentValue: dataPropertyValue,
        path: [...parentContext.path, dataProperty],
      };
      if (captureProperty) {
        parentContext.captures[captureProperty] = dataProperty;
      }

      // Add the node to the corresponding resource table based on the specified mapping
      if (isResourceFieldMapping(mapping)) {
        pushResourceFieldMapping({ aseloResource, mapping, context });
      } else if (isReferenceAttributeMapping(mapping)) {
        pushReferenceAttributeMapping({ aseloResource, mapping, context });
      } else if (isTranslatableAttributeMapping(mapping)) {
        pushTranslatableAttributeMapping({ aseloResource, mapping, context });
      } else if (isInlineAttributeMapping(mapping)) {
        pushInlineAttributeMapping({ aseloResource, mapping, context });
      }

      // Recurse on the children node(s) if any
      if (children) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { _id, ...rest } = children;
        // const { _id, objectId, ...rest } = children;
        mapNode(rest, dataPropertyValue, context, aseloResource);
      }
    });
  });

  return aseloResource;
};

export const transformExternalResourceToApiResource = <T>(
  resourceMapping: MappingNode,
  khpResource: T,
): ImportApiResource => {
  const resource: ImportApiResource = {
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
  };

  return mapNode(
    resourceMapping,
    khpResource,
    { captures: {}, path: [], rootResource: khpResource },
    resource,
  );
};

export const transformKhpResourceToApiResource = (
  khpResource: KhpApiResource,
): ImportApiResource =>
transformExternalResourceToApiResource(mappings.khp.KHP_MAPPING_NODE, khpResource);
