import { ImportApiResource } from '@tech-matters/types';
import { KhpApiResource } from '.';
import {
  FieldMappingContext,
  KhpMappingNode,
  isKhpInlineAttributeMapping,
  isKhpReferenceAttributeMapping,
  isKhpResourceFieldMapping,
  isKhpTranslatableAttributeMapping,
} from './khpMappings';

/**
 * Function to map a KHP node into an Aselo resource.
 * Recusively transform the children (if any) and returns them alongside
 * @param mappingNode
 * @param dataNode
 * @param parentContext
 * @param aseloResource
 * @returns
 */
const mapNode = (
  mappingNode: KhpMappingNode,
  dataNode: any,
  parentContext: FieldMappingContext,
  aseloResource: ImportApiResource,
): ImportApiResource => {
  Object.entries(mappingNode).forEach(([property, { children, ...mapping }]) => {
    const captureProperty = property.match(/{(?<captureProperty>.*)}/)?.groups?.captureProperty;
    const dataProperties: string[] = (captureProperty ? Object.keys(dataNode) : [property])
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

      // Add the node to the corresponding resource table based on the mapping specified
      if (isKhpResourceFieldMapping(mapping)) {
        aseloResource[mapping.field] = mapping.valueGenerator(context);
      } else if (isKhpReferenceAttributeMapping(mapping)) {
        aseloResource.attributes.ResourceReferenceStringAttributes.push({
          key: mapping.keyGenerator(context),
          value: mapping.valueGenerator(context),
          language: mapping.languageGenerator(context),
          list: mapping.list,
        });
      } else if (isKhpTranslatableAttributeMapping(mapping)) {
        aseloResource.attributes[mapping.table].push({
          key: mapping.keyGenerator(context),
          value: mapping.valueGenerator(context),
          language: mapping.languageGenerator(context),
          info: mapping.infoGenerator(context),
        });
      } else if (isKhpInlineAttributeMapping(mapping)) {
        aseloResource.attributes[mapping.table].push({
          key: mapping.keyGenerator(context),
          value: mapping.valueGenerator(context),
          info: mapping.infoGenerator(context),
        } as any);
      }

      if (children) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { _id, objectId, ...rest } = children;
        // Recurse on the children node(s)
        mapNode(rest, dataPropertyValue, context, aseloResource);
      }
    });
  });

  return aseloResource;
};

export const transformKhpResourceToApiResource = (
  resourceMapping: KhpMappingNode,
  khpResource: KhpApiResource,
): ImportApiResource => {
  const {
    khpReferenceNumber,
    name,
    timestamps: { updatedAt },
  } = khpResource;

  const resource: ImportApiResource = {
    id: khpReferenceNumber.toString(),
    updatedAt,
    name,
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
