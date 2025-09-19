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

import type { AccountSID } from '@tech-matters/types';
import type {
  FlatResource,
  InlineAttributeProperty,
} from '@tech-matters/resources-types';
import {
  FieldMappingContext,
  InlineAttributeMapping,
  MappingNode,
  ReferenceAttributeMapping,
  ResourceFieldMapping,
  isInlineAttributeMapping,
  isReferenceAttributeMapping,
  isResourceFieldMapping,
  isTranslatableAttributeMapping,
  isResourceMappingList,
  ResourceMapping,
} from './mappers';
import { isValid, parseISO } from 'date-fns';

const pushResourceFieldMapping = ({
  aseloResource,
  context,
  mapping,
}: {
  mapping: Omit<ResourceFieldMapping, 'children'>;
  aseloResource: FlatResource;
  context: FieldMappingContext;
}): void => {
  aseloResource[mapping.field] = mapping.valueGenerator(context);
};

const pushReferenceAttributeMapping = ({
  aseloResource,
  context,
  mapping,
}: {
  mapping: Omit<ReferenceAttributeMapping, 'children'>;
  aseloResource: FlatResource;
  context: FieldMappingContext;
}): void => {
  const value = mapping.valueGenerator(context);
  const key = mapping.keyGenerator(context);

  if (value === null || value === undefined) {
    // console.debug(
    //   `No value provided to referenceStringAttributes: key ${key} and value ${value} - omitting attribute`,
    // );
    return;
  }
  if (typeof value !== 'string') {
    console.info(
      `Wrong value provided to referenceStringAttributes: key ${key} and value ${value} - omitting attribute`,
    );
    return;
  }

  aseloResource.referenceStringAttributes.push({
    key: mapping.keyGenerator(context),
    value: mapping.valueGenerator(context) ?? '',
    language: mapping.languageGenerator(context),
    list: mapping.list,
  });
};

const pushInlineAttributeMapping = <T extends InlineAttributeProperty>({
  aseloResource,
  context,
  mapping,
}: {
  mapping: Omit<InlineAttributeMapping<T>, 'children'>;
  aseloResource: FlatResource;
  context: FieldMappingContext;
}): void => {
  const value = mapping.valueGenerator(context);
  const key = mapping.keyGenerator(context);
  let info = mapping.infoGenerator(context) ?? null;

  if (typeof info !== 'object' && info !== null) {
    console.warn(
      `Wrong value provided to info: key ${key} and info ${value} - setting info as null`,
    );
    info = null;
  }

  if (value === null || value === undefined) {
    // console.debug(
    //   `No value provided to ${mapping.property}: key ${key} and value ${value} - omitting attribute`,
    // );
    return;
  }

  if (mapping.property === 'stringAttributes') {
    if (typeof value !== 'string') {
      console.warn(
        `Wrong value provided to stringAttributes: key ${key} and value ${value} - omitting attribute`,
      );
      return;
    }

    aseloResource.stringAttributes.push({
      key,
      value,
      info: mapping.infoGenerator(context),
      language: isTranslatableAttributeMapping(mapping)
        ? mapping.languageGenerator(context)
        : '',
    });
  } else if (mapping.property === 'booleanAttributes') {
    if (typeof value !== 'boolean') {
      console.info(
        `Wrong value provided to ResourceBooleanAttributes: key ${key} and value ${value} - omitting attribute`,
      );
      return;
    }

    aseloResource.booleanAttributes.push({
      key,
      value,
      info: mapping.infoGenerator(context),
    });
  } else if (mapping.property === 'numberAttributes') {
    if (typeof value !== 'number') {
      console.info(
        `Wrong value provided to ResourceNumberAttributes: mapping ${key} and value ${value} - omitting attribute`,
      );
      return;
    }

    aseloResource.numberAttributes.push({
      key,
      value,
      info: mapping.infoGenerator(context),
    });
  } else if (mapping.property === 'dateTimeAttributes') {
    if (typeof value !== 'string' || !isValid(parseISO(value))) {
      console.info(
        `Wrong value provided to ResourceDateTimeAttributes: key:${key} and value ${value} - omitting attribute`,
      );
      return;
    }

    aseloResource.dateTimeAttributes.push({
      key,
      value,
      info: mapping.infoGenerator(context),
    });
  } else {
    console.warn(
      `Unhandled case for provided mapping: mapping ${JSON.stringify(mapping)}`,
    );
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
  Object.entries(mappingNode).forEach(([property, { children, ...rest }]) => {
    const captureProperty = property.match(/{(?<captureProperty>.*)}/)?.groups
      ?.captureProperty;

    // If there are sibling keys to the dynamic capture, treat them as static
    const { [`{${captureProperty}}`]: capturePropertyMapping, ...staticMappings } =
      captureProperty ? mappingNode : {};
    const staticKeys = Object.keys(staticMappings);
    const rawDataProperties = captureProperty
      ? Object.keys(dataNode).filter(k => k && !staticKeys.includes(k))
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
        parentValue: parentContext.currentValue,
        currentValue: dataPropertyValue,
        path: [...parentContext.path, dataProperty],
      };
      if (captureProperty) {
        parentContext.captures[captureProperty] = dataProperty;
      }
      const mappings: (ResourceMapping | {})[] = isResourceMappingList(rest)
        ? rest.mappings
        : [rest];
      mappings.forEach(mapping => {
        // Add the node to the corresponding resource table based on the specified mapping
        if (isResourceFieldMapping(mapping)) {
          pushResourceFieldMapping({ aseloResource, mapping, context });
        } else if (isReferenceAttributeMapping(mapping)) {
          pushReferenceAttributeMapping({ aseloResource, mapping, context });
        } else if (isInlineAttributeMapping(mapping)) {
          pushInlineAttributeMapping({ aseloResource, mapping, context });
        }
      });

      // Recurse on the children node(s) if any
      if (children && typeof dataPropertyValue === 'object') {
        mapNode(children, dataPropertyValue, context, aseloResource);
      }
    });
  });

  return aseloResource;
};

export const transformExternalResourceToApiResource = <T>(
  resourceMapping: MappingNode,
  accountSid: AccountSID,
  externalResource: T,
): FlatResource => {
  const resource: FlatResource = {
    accountSid,
    id: '',
    lastUpdated: '',
    deletedAt: '',
    name: '',
    stringAttributes: [],
    numberAttributes: [],
    booleanAttributes: [],
    dateTimeAttributes: [],
    referenceStringAttributes: [],
  };

  return mapNode(
    resourceMapping,
    externalResource,
    { captures: {}, path: [], rootResource: externalResource },
    resource,
  );
};
