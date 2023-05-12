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

import {
  AttributeTable,
  AttributeValue,
  InlineAttributeTable,
  isResourceDateTimeAttributes,
} from '@tech-matters/types';
import parseISO from 'date-fns/parseISO';

/**
 * A mapping context provides information about the current attribute being processed.
 * It is consumed when recursively generating the nested attributes related to a resource.
 */
export type FieldMappingContext = {
  currentValue?: any;
  captures: Record<string, string>;
  path: string[];
  rootResource: any;
};

type ContextConsumerFunc<T> = (context: FieldMappingContext) => T;
type ValueOrContextConsumerFunc<T> = T | ContextConsumerFunc<T>;

const isContextConsumerFunc = <T>(
  fun: ValueOrContextConsumerFunc<T>,
): fun is ContextConsumerFunc<T> => {
  if (typeof fun === 'function') {
    return true;
  }

  return false;
};

/**
 * Maps the only properties of a resource that belong to the resources table: id and name. Any other property will be mapped into one of the attributes tables.
 */
export type KhpResourceFieldMapping = {
  field: 'id' | 'name';
  valueGenerator: ContextConsumerFunc<any>;
};

/**
 * Maps a resource attribute to the corresponding AttributeTable.
 * The next types are refinements on this one to specify the context needed to map to the refined AttributeTable
 */
// type KhpAttributeMapping<T extends AttributeTable> = {
type KhpAttributeMapping<T extends AttributeTable> = {
  table: T;
  keyGenerator: ContextConsumerFunc<string>;
  valueGenerator: ContextConsumerFunc<AttributeValue<T>>;
  infoGenerator: ContextConsumerFunc<Record<string, any> | null>;
};

export type KhpInlineAttributeMapping<T extends InlineAttributeTable> = KhpAttributeMapping<T>;

export type KhpTranslatableAttributeMapping = KhpAttributeMapping<'ResourceStringAttributes'> & {
  languageGenerator: ContextConsumerFunc<string>;
};

export type KhpReferenceAttributeMapping = Omit<
  KhpAttributeMapping<'ResourceReferenceStringAttributes'>,
  'infoGenerator'
> & {
  list: string;
  languageGenerator: ContextConsumerFunc<string>;
};

export const isKhpResourceFieldMapping = (mapping: any): mapping is KhpResourceFieldMapping => {
  return mapping && mapping.field;
};

export const isKhpInlineAttributeMapping = <T extends InlineAttributeTable>(
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

export const isKhpReferenceAttributeMapping = (
  mapping: any,
): mapping is KhpReferenceAttributeMapping => {
  return (
    mapping &&
    mapping.table === 'ResourceReferenceStringAttributes' &&
    typeof mapping.keyGenerator === 'function' &&
    typeof mapping.valueGenerator === 'function' &&
    typeof mapping.list === 'string' &&
    mapping.list
  );
};

export const isKhpTranslatableAttributeMapping = (
  mapping: any,
): mapping is KhpTranslatableAttributeMapping => {
  return (
    typeof mapping?.languageGenerator === 'function' &&
    isKhpInlineAttributeMapping<'ResourceStringAttributes'>(mapping)
  );
};

/**
 * A node is a single item to be mapped into one of the above possible types.
 * If the node contains "children", it means we want to recurse on them.
 */
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
  value?: ContextConsumerFunc<string>, // can we refine this type?
): KhpResourceFieldMapping => ({
  field,
  valueGenerator: value || (context => context.currentValue),
});

export const khpAttributeMapping = <T extends AttributeTable>(
  table: T,
  key: ValueOrContextConsumerFunc<string>,
  {
    value = context => context.currentValue,
    info = () => null,
  }: {
    value?: ValueOrContextConsumerFunc<AttributeValue<T>>;
    info?: ContextConsumerFunc<Record<string, any> | null>;
  } = {},
): KhpAttributeMapping<AttributeTable> => ({
  table,
  keyGenerator: typeof key === 'function' ? key : context => substitueCaptureTokens(key, context),
  valueGenerator:
    typeof value === 'function'
      ? value
      : () =>
          isResourceDateTimeAttributes(table) && value && typeof value === 'string'
            ? parseISO(value).toString()
            : value,
  infoGenerator: typeof info === 'function' ? info : () => info,
});

export const khpTranslatableAttributeMapping = (
  key: ValueOrContextConsumerFunc<string>,
  {
    value = context => context.currentValue,
    info = () => null,
    language = () => '',
  }: {
    value?: ValueOrContextConsumerFunc<string>;
    info?: ContextConsumerFunc<Record<string, any> | null>;
    language?: ValueOrContextConsumerFunc<string>;
  } = {},
): KhpTranslatableAttributeMapping => {
  const mappingResult = khpAttributeMapping('ResourceStringAttributes', key, {
    value,
    info,
  });

  // This case should be impossible but we gotta help TS
  if (!isKhpInlineAttributeMapping<'ResourceStringAttributes'>(mappingResult)) {
    throw new Error(
      `Panic! mappingResult is not KhpInlineAttributeMapping<ResourceStringAttributes>: ${mappingResult}`,
    );
  }

  return {
    ...mappingResult,
    languageGenerator: typeof language === 'function' ? language : () => language,
  };
};

export const khpReferenceAttributeMapping = (
  key: ValueOrContextConsumerFunc<string>,
  list: string,
  data: {
    value?: ValueOrContextConsumerFunc<AttributeValue<'ResourceReferenceStringAttributes'>>;
    language?: ValueOrContextConsumerFunc<string>;
  } = {},
): KhpReferenceAttributeMapping => {
  const { infoGenerator, ...mappingResult } = khpAttributeMapping(
    'ResourceReferenceStringAttributes',
    key,
    data,
  );

  // This case should be impossible but we gotta help TS
  if (!isKhpReferenceAttributeMapping(mappingResult)) {
    throw new Error(`Panic! mappingResult is not KhpReferenceAttributeMapping: ${mappingResult}`);
  }

  if (isContextConsumerFunc(data.language)) {
    return {
      ...mappingResult,
      languageGenerator: data.language,
      list,
    };
  }

  const languageGeneratorResult = data.language || '';

  return {
    ...mappingResult,
    languageGenerator: () => languageGeneratorResult,
    list,
  };
};

// TODO: Change objectId to site ID when we have it
const siteKey = (subsection: string) => (context: FieldMappingContext) => {
  const {
    rootResource,
    captures: { siteIndex },
  } = context;
  return `site/${rootResource.sites[siteIndex].objectId}/${substitueCaptureTokens(
    subsection,
    context,
  )}`;
};

/*
 * This defines all the mapping logic to convert KHP resource to an Aselo resource.
 * The mapping is defined as a tree of nodes.
 * If the content of this node needs to be written to the Aselo DB, it should be provided a "khp mapping" function, depending on where the data should be written.
 * Child nodes are defined within the `children` property. This are processed recursively.
 * If the names of the child nodes are dynamic, e.g. one per language, or one per social media channel, the node should be named with a placeholder token, e.g. '{language}' or '{channel}'. This will make the importer process all child data nodes and capture their property under `captures` property of the context object for use generating keys, values & info etc..
 */
export const KHP_MAPPING_NODE: KhpMappingNode = {
  khpReferenceNumber: khpResourceFieldMapping('id'),
  sites: {
    children: {
      '{siteIndex}': {
        children: {
          name: {
            children: {
              '{language}': khpTranslatableAttributeMapping(siteKey('name'), {
                language: context => context.captures.language,
              }),
            },
          },
          details: {
            children: {
              '{language}': khpTranslatableAttributeMapping(siteKey('details'), {
                value: siteKey('details'),
                info: context => context.currentValue,
                language: context => context.captures.language,
              }),
            },
          },
          isActive: khpAttributeMapping('ResourceBooleanAttributes', siteKey('isActive')),
          isLocationPrivate: khpAttributeMapping(
            'ResourceBooleanAttributes',
            siteKey('isLocationPrivate'),
          ),
          location: {
            children: {
              address1: khpAttributeMapping(
                'ResourceStringAttributes',
                siteKey('location/address1'),
              ),
              address2: khpAttributeMapping(
                'ResourceStringAttributes',
                siteKey('location/address2'),
              ),
              city: khpAttributeMapping('ResourceStringAttributes', siteKey('location/city')),
              county: khpAttributeMapping('ResourceStringAttributes', siteKey('location/county')),
              province: khpReferenceAttributeMapping(siteKey('location/province'), 'provinces'),
              country: khpReferenceAttributeMapping(siteKey('location/country'), 'countries'),
              postalCode: khpAttributeMapping(
                'ResourceStringAttributes',
                siteKey('location/postalCode'),
              ),
            },
          },
          email: khpAttributeMapping('ResourceStringAttributes', siteKey('email')),
          operations: {
            children: {
              '{dayIndex}': {
                children: {
                  '{language}': khpTranslatableAttributeMapping(siteKey('operations/{dayIndex}'), {
                    value: context => context.currentValue.day,
                    info: context => context.currentValue,
                    language: context => context.captures.language,
                  }),
                },
              },
            },
          },
          phoneNumbers: {
            children: {
              '{phoneNumberType}': khpAttributeMapping(
                'ResourceStringAttributes',
                siteKey('phone/{phoneNumberType}'),
              ),
            },
          },
        },
      },
    },
  },
  name: khpResourceFieldMapping(
    'name',
    context => context.currentValue.en || context.currentValue.fr,
  ),
  nameDetails: {
    children: {
      '{language}': khpTranslatableAttributeMapping('nameDetails', {
        value: ctx => ctx.currentValue.official || ctx.currentValue.alternate,
        info: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  applicationProcess: {
    children: {
      '{language}': khpTranslatableAttributeMapping('applicationProcess', {
        value: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  capacity: {
    children: {
      '{language}': khpTranslatableAttributeMapping('capacity', {
        value: ctx => ctx.currentValue.value,
        info: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  // TODO: this are all null in the samples, I don't know what to map to
  // social: {
  //   children: {

  //   }
  // }
  eligibilityDetails: {
    children: {
      phrase: {
        children: {
          '{language}': khpTranslatableAttributeMapping('phrase', {
            value: ctx => ctx.currentValue,
            language: ctx => ctx.captures.language,
          }),
        },
      },
    },
  },
  website: {
    children: {
      '{language}': khpTranslatableAttributeMapping('website', {
        value: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  // TODO: is this one correct?
  metadata: {
    children: {
      '{language}': {
        children: {
          '{property}': khpTranslatableAttributeMapping('metadata/{property}', {
            // TODO: I'm sure this is not correct, but some seem to be objects and others strings? Or nulls are strings too?
            value: ctx => ctx.captures.property,
            info: ctx => ctx.currentValue,
            language: ctx => ctx.captures.language,
          }),
        },
      },
    },
  },
  // TODO: this are all null in the samples, I don't know what to map to
  // transportation: {
  //   children: {
  //     '{language}': khpTranslatableAttributeMapping('transportation', {

  //     })
  //   }
  // }
  seniorOrgContact: {
    children: {
      title: {
        children: {
          '{language}': khpTranslatableAttributeMapping('seniorOrgContact', {
            value: ctx => ctx.currentValue,
            language: ctx => ctx.captures.language,
          }),
        },
      },
      isPrivate: khpAttributeMapping('ResourceBooleanAttributes', 'isPrivate', {
        value: ctx => ctx.currentValue,
      }),
      name: khpAttributeMapping('ResourceStringAttributes', 'name', {
        value: ctx => ctx.currentValue,
      }),
      // I'm assuming this one, since it's always null
      email: khpAttributeMapping('ResourceStringAttributes', 'email', {
        value: ctx => ctx.currentValue,
      }),
      // I'm assuming this one, since it's always "false" (no, not false, string "false")
      phone: khpAttributeMapping('ResourceStringAttributes', 'phone', {
        value: ctx => ctx.currentValue,
      }),
    },
  },
  lastVerifiedOn: khpAttributeMapping('ResourceStringAttributes', 'lastVerifiedOn', {
    value: ctx => ctx.currentValue,
  }),
  description: {
    children: {
      '{language}': khpTranslatableAttributeMapping('description', {
        // TODO: this was previously mapped as 'description' (string). Was that intended?
        value: ctx => ctx.currentValue,
        info: context => ({ text: context.currentValue }),
        language: ctx => ctx.captures.language,
      }),
    },
  },
  isActive: khpAttributeMapping('ResourceBooleanAttributes', 'isActive', {
    value: ctx => ctx.currentValue,
  }),
  mailingAddresses: {
    children: {
      '{addressIndex}': {
        children: {
          address1: khpAttributeMapping(
            'ResourceStringAttributes',
            'mailingAddresses/{addressIndex}/address1',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          address2: khpAttributeMapping(
            'ResourceStringAttributes',
            'mailingAddresses/{addressIndex}/address2',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          isPrivate: khpAttributeMapping(
            'ResourceBooleanAttributes',
            'mailingAddresses/{addressIndex}/isActive',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          city: khpReferenceAttributeMapping('mailingAddresses/{addressIndex}/city', 'cities'),
          province: khpReferenceAttributeMapping(
            'mailingAddresses/{addressIndex}/province',
            'provinces',
          ),
          country: khpReferenceAttributeMapping(
            'mailingAddresses/{addressIndex}/country',
            'countries',
          ),
          postalCode: khpAttributeMapping(
            'ResourceStringAttributes',
            'mailingAddresses/{addressIndex}/postalCode',
          ),
        },
      },
    },
  },
  physicalAddresses: {
    children: {
      '{addressIndex}': {
        children: {
          address1: khpAttributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/address1',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          address2: khpAttributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/address2',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          isPrivate: khpAttributeMapping(
            'ResourceBooleanAttributes',
            'physicalAddresses/{addressIndex}/isActive',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          city: khpReferenceAttributeMapping('physicalAddresses/{addressIndex}/city', 'cities'),
          county: khpReferenceAttributeMapping(
            'physicalAddresses/{addressIndex}/country',
            'counties',
          ),
          province: khpReferenceAttributeMapping(
            'physicalAddresses/{addressIndex}/province',
            'provinces',
          ),
          country: khpReferenceAttributeMapping(
            'physicalAddresses/{addressIndex}/country',
            'countries',
          ),
          postalCode: khpAttributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/postalCode',
          ),
          description: khpAttributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/description',
          ),
          longitude: khpAttributeMapping(
            'ResourceNumberAttributes',
            'physicalAddresses/{addressIndex}/longitude',
          ),
          latitude: khpAttributeMapping(
            'ResourceNumberAttributes',
            'physicalAddresses/{addressIndex}/latitude',
          ),
        },
      },
    },
  },
  primaryLocationCity: khpReferenceAttributeMapping('primaryLocationCity', 'cities'),
  primaryLocationCounty: khpReferenceAttributeMapping('primaryLocationCounty', 'counties'),
  primaryLocationProvince: khpReferenceAttributeMapping('primaryLocationProvince', 'provinces'),
  primaryLocationPostalCode: khpAttributeMapping(
    'ResourceStringAttributes',
    'primaryLocationPostalCode',
  ),
  primaryLocationAddress1: khpAttributeMapping(
    'ResourceStringAttributes',
    'primaryLocationAddress1',
  ),
  primaryLocationAddress2: khpAttributeMapping(
    'ResourceStringAttributes',
    'primaryLocationAddress2',
  ),
  primaryLocationPhone: khpAttributeMapping('ResourceStringAttributes', 'primaryLocationPhone'),
  primaryLocationIsPrivate: khpAttributeMapping(
    'ResourceBooleanAttributes',
    'primaryLocationIsPrivate',
  ),
  coverage: {
    children: {
      '{language}': khpTranslatableAttributeMapping('coverage', {
        value: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  targetPopulations: {
    children: {
      '{targetPopulationIndex}': khpReferenceAttributeMapping(
        'targetPopulation/{targetPopulationIndex}',
        'khp-target-populations',
      ),
    },
  },
  // TODO: this is always an empty array
  // targetPopulations: {
  //   children: {

  //   }
  // }
  eligibilityMinAge: khpAttributeMapping('ResourceNumberAttributes', 'eligibilityMinAge', {
    value: ctx => ctx.currentValue,
  }),
  eligibilityMaxAge: khpAttributeMapping('ResourceNumberAttributes', 'eligibilityMaxAge', {
    value: ctx => ctx.currentValue,
  }),
  phoneNumbers: {
    children: {
      '{phoneNumberIndex}': khpAttributeMapping(
        'ResourceStringAttributes',
        'phoneNumbers/{phoneNumberIndex}',
        {
          info: context => context.currentValue,
          value: context => context.currentValue.number,
        },
      ),
    },
  },
  mainContact: {
    children: {
      name: khpAttributeMapping('ResourceStringAttributes', 'mainContact/name'),
      email: khpAttributeMapping('ResourceStringAttributes', 'mainContact/email'),
      title: {
        children: {
          '{language}': khpTranslatableAttributeMapping('mainContact/title', {
            language: context => context.captures.language,
          }),
        },
      },
      phone: khpAttributeMapping('ResourceStringAttributes', 'mainContact/phone'),
      isPrivate: khpAttributeMapping('ResourceBooleanAttributes', 'mainContact/isPrivate'),
    },
  },
  documentsRequired: {
    children: {
      '{documentIndex}': khpTranslatableAttributeMapping('documentsRequired/{documentIndex}', {
        value: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  // TODO: this is null in all the samples
  // paymentMethod: {

  // }
  operations: {
    children: {
      '{dayIndex}': {
        children: {
          '{language}': khpTranslatableAttributeMapping('operations/{dayIndex}', {
            value: context => context.currentValue.day,
            info: context => context.currentValue,
            language: context => context.captures.language,
          }),
        },
      },
    },
  },
  // TODO: this is an array. Should we instead map like languages: { chidlren: { ... }}?
  languages: khpReferenceAttributeMapping('languages', 'khp-languages', {
    value: context => context.currentValue.language,
  }),
  interpretationTranslationServicesAvailable: khpAttributeMapping(
    'ResourceBooleanAttributes',
    'interpretationTranslationServicesAvailable',
  ),
  available247: khpAttributeMapping('ResourceBooleanAttributes', 'available247'),
  feeStructureSource: khpReferenceAttributeMapping(
    'feeStructureSource',
    'khp-fee-structure-source',
  ),
  howIsServiceOffered: khpReferenceAttributeMapping(
    'howIsServiceOffered',
    'khp-how-is-service-offered',
  ),
  accessibility: khpReferenceAttributeMapping('accessibility', 'khp-accessibility'),
  howToAccessSupport: khpReferenceAttributeMapping(
    'howToAccessSupport',
    'khp-how-to-access-support',
  ),
  isHighlighted: khpAttributeMapping('ResourceBooleanAttributes', 'isHighlighted', {
    value: ctx => ctx.currentValue,
  }),
  keywords: khpAttributeMapping('ResourceStringAttributes', 'keywords', {
    value: ctx => ctx.currentValue.join(' '),
    info: ctx => ({ keywords: ctx.currentValue }),
  }),
  createdAt: khpAttributeMapping('ResourceDateTimeAttributes', 'sourceCreatedAt'),
  updatedAt: khpAttributeMapping('ResourceDateTimeAttributes', 'sourceUpdatedAt'),
  retiredAt: khpAttributeMapping('ResourceDateTimeAttributes', 'sourceRetiredAt'),
  // TODO: this is an array of arrays, is this shape correct?
  taxonomies: {
    children: {
      '{arrayIndex}': {
        children: {
          '{taxonomyIndex}': khpReferenceAttributeMapping(
            'taxonomies/{arrayIndex}/{taxonomyIndex}',
            'khp-taxonomy-codes',
          ),
        },
      },
    },
  },
  // TODO: this is an empty array
  // notes: {

  // }
  verifications: {
    children: {
      '{verificationIndex}': khpAttributeMapping(
        'ResourceStringAttributes',
        'verifications/{verificationIndex}',
        {
          value: ctx => ctx.currentValue.name,
          info: ctx => ctx.currentValue,
        },
      ),
    },
  },
  // TODO: this one is absent in the new sample
  // status: khpReferenceAttributeMapping('status', 'khp-resource-statuses'),
};

export const KHP_RESOURCE_REFERENCES = {
  countries: [
    {
      id: 'Canada',
      value: 'Canada',
      info: null,
    },
  ],
  provinces: [
    {
      id: 'AB',
      value: 'AB',
      info: {
        name: 'Alberta',
      },
    },
    {
      id: 'BC',
      value: 'BC',
      info: {
        name: 'British Columbia',
      },
    },
    {
      id: 'MB',
      value: 'MB',
      info: {
        name: 'Manitoba',
      },
    },
    {
      id: 'NB',
      value: 'NB',
      info: {
        name: 'New Brunswick',
      },
    },
    {
      id: 'NL',
      value: 'NL',
      info: {
        name: 'Newfoundland and Labrador',
      },
    },
    {
      id: 'NS',
      value: 'NS',
      info: {
        name: 'Nova Scotia',
      },
    },
    {
      id: 'NT',
      value: 'NT',
      info: {
        name: 'Northwest Territories',
      },
    },
    {
      id: 'NU',
      value: 'NU',
      info: {
        name: 'Nunavut',
      },
    },
    {
      id: 'ON',
      value: 'ON',
      info: {
        name: 'Ontario',
      },
    },
    {
      id: 'PE',
      value: 'PE',
      info: {
        name: 'Prince Edward Island',
      },
    },
    {
      id: 'QC',
      value: 'QC',
      info: {
        name: 'Quebec',
      },
    },
    {
      id: 'SK',
      value: 'SK',
      info: {
        name: 'Saskatchewan',
      },
    },
    {
      id: 'YT',
      value: 'YT',
      info: {
        name: 'Yukon',
      },
    },
  ],
  counties: [],
  cities: [
    {
      id: 'Canada/NB/Victoria/Perth-Andover',
      value: 'Canada/NB/Victoria/Perth-Andover',
      info: {
        name: 'Perth-Andover',
        county: 'Victoria',
        province: 'NB',
        country: 'Canada',
      },
    },
    {
      id: 'Canada/AB/Rocky View County/Calgary',
      value: 'Canada/AB/Rocky View County/Calgary',
      info: {
        name: 'Calgary',
        county: 'Rocky View County',
        province: 'AB',
        country: 'Canada',
      },
    },
    {
      id: 'Canada/ON/Middlesex/London',
      value: 'Canada/ON/Middlesex/London',
      info: {
        name: 'London',
        county: 'Middlesex',
        province: 'ON',
        country: 'Canada',
      },
    },
  ],
  'khp-resource-statuses': [
    {
      id: 'Active',
      value: 'Active',
      info: null,
    },
  ],
  'khp-target-populations': [
    {
      id: 'Open To All',
      value: 'Open To All',
      info: null,
    },
  ],
  'khp-fee-structure-source': [
    {
      id: 'Free',
      value: 'Free',
      info: null,
    },
    {
      id: 'Sliding Scale',
      value: 'Sliding Scale',
      info: null,
    },
  ],
  'khp-how-to-access-support': [
    {
      id: 'Appointment Required',
      value: 'Appointment Required',
      info: null,
    },
  ],
  'khp-how-is-service-offered': [
    {
      id: 'In-Person Support',
      value: 'In-Person Support',
      info: null,
    },
  ],
  'khp-accessibility': [
    {
      id: 'Wheelchair Accessible',
      value: 'Wheelchair Accessible',
      info: null,
    },
  ],
  'khp-languages': [
    {
      id: 'en',
      value: 'English',
      info: {
        code: 'en',
        language: 'English',
      },
    },
    {
      id: 'fr',
      value: 'French',
      info: {
        code: 'fr',
        language: 'French',
      },
    },
    {
      id: 'cr',
      value: 'Cree',
      info: {
        code: 'cr',
        language: 'Cree',
      },
    },
    {
      // id: ??
      value: 'American Sign Language',
      info: {
        code: '',
        language: 'American Sign Language',
      },
    },
  ],
  'khp-taxonomy-codes': [
    {
      id: '0',
      value: '0',
      info: null,
    },
    {
      id: 'RM-6500.1500; RF-3300; RF-2000; RF-2500; RX-8450.8000',
      value: 'RM-6500.1500; RF-3300; RF-2000; RF-2500; RX-8450.8000',
      info: null,
    },
    {
      id: 'HP1234-01',
      value: 'HP1234-01',
      info: null,
    },
  ],
};
