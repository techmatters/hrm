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
import type { AccountSID, FlatResource, InlineAttributeProperty } from '@tech-matters/types';
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
import * as khp from './khpMappings';

const pushResourceFieldMapping = ({ aseloResource, context, mapping }: {
  mapping: Omit<ResourceFieldMapping, 'children'>, 
  aseloResource: FlatResource,
  context: FieldMappingContext
}): void => {
  aseloResource[mapping.field] = mapping.valueGenerator(context);
};

const pushReferenceAttributeMapping = ({ aseloResource, context, mapping }: {
  mapping: Omit<ReferenceAttributeMapping, 'children'>, 
  aseloResource: FlatResource,
  context: FieldMappingContext
}): void => {
  aseloResource.referenceStringAttributes.push({
    key: mapping.keyGenerator(context),
    value: mapping.valueGenerator(context),
    language: mapping.languageGenerator(context),
    list: mapping.list,
  });
};

const pushTranslatableAttributeMapping = ({ aseloResource, context, mapping }: {
  mapping: Omit<TranslatableAttributeMapping, 'children'>, 
  aseloResource: FlatResource,
  context: FieldMappingContext
}): void => {
  aseloResource[mapping.property].push({
    key: mapping.keyGenerator(context),
    value: mapping.valueGenerator(context),
    language: mapping.languageGenerator(context),
    info: mapping.infoGenerator(context),
  });
};

const pushInlineAttributeMapping = <T extends InlineAttributeProperty>({ aseloResource, context, mapping }: {
  mapping: Omit<InlineAttributeMapping<T>, 'children'>, 
  aseloResource: FlatResource,
  context: FieldMappingContext
}): void => {
  const value = mapping.valueGenerator(context);
  const key = mapping.keyGenerator(context);
  if (mapping.property === 'stringAttributes') {
    if (typeof value !== 'string') {
      console.info(`Wrong value provided to stringAttributes: key ${key} and value ${value} - omitting attribute`);
      return;
    }

    aseloResource.stringAttributes.push({
      key: mapping.keyGenerator(context),
      value,
      info: mapping.infoGenerator(context),
      language: '',
    });
  } else if (mapping.property === 'booleanAttributes') {
    if (typeof value !== 'boolean') {
      console.info(`Wrong value provided to ResourceBooleanAttributes: key ${key} and value ${value} - omitting attribute`);
      return;
    }

    aseloResource.booleanAttributes.push({
      key: mapping.keyGenerator(context),
      value,
      info: mapping.infoGenerator(context),
    });
  } else if (mapping.property ===  'numberAttributes') {
    if (typeof value !== 'number') {
      console.info(`Wrong value provided to ResourceNumberAttributes: mapping ${key} and value ${value} - omitting attribute`);
      return;
    }

    aseloResource.numberAttributes.push({
      key: mapping.keyGenerator(context),
      value,
      info: mapping.infoGenerator(context),
    });
  } else if (mapping.property === 'dateTimeAttributes') {
    if (typeof value !== 'string') {
      console.info(`Wrong value provided to ResourceDateTimeAttributes: key:${key} and value ${value} - omitting attribute`);
      return;
    }

    aseloResource.dateTimeAttributes.push({
      key,
      value,
      info: mapping.infoGenerator(context),
    });
  } else {
    console.warn(`Unhandled case for provided mapping: mapping ${JSON.stringify(mapping)}`);
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
  aseloResource: FlatResource,
): FlatResource => {
  Object.entries(mappingNode).forEach(([property, { children, ...mapping }]) => {
    const captureProperty = property.match(/{(?<captureProperty>.*)}/)?.groups?.captureProperty;

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
        mapNode(children, dataPropertyValue, context, aseloResource);
      }
    });
  });

  return aseloResource;
};

export const transformExternalResourceToApiResource = <T>(
  resourceMapping: MappingNode,
  accountSid: AccountSID,
  khpResource: T,
): FlatResource => {
  const resource: FlatResource = {
    accountSid,
    id: '',
    lastUpdated: '',
    name: '',
    stringAttributes: [],
    numberAttributes: [],
    booleanAttributes: [],
    dateTimeAttributes: [],
    referenceStringAttributes: [],
  };

  return mapNode(
    resourceMapping,
    khpResource,
    { captures: {}, path: [], rootResource: khpResource },
    resource,
  );
};

export const transformKhpResourceToApiResource = (
  accountSid: AccountSID,
  khpResource: KhpApiResource,
): FlatResource =>
transformExternalResourceToApiResource(khp.KHP_MAPPING_NODE, accountSid, khpResource);
