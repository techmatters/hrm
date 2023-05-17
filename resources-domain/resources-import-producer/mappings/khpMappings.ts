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
  FieldMappingContext,
  MappingNode,
  substitueCaptureTokens,
  resourceFieldMapping,
  attributeMapping,
  translatableAttributeMapping,
  referenceAttributeMapping,
} from '../mappers';

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

const KHP_MAPPING_NODE_SITES: { children: MappingNode } = {
  children: {
    '{siteIndex}': {
      children: {
        notes: {
          children: {
            '{noteIndex}': attributeMapping(
              'ResourceStringAttributes',
              siteKey('notes/{noteIndex}'),
              {
                value: ctx => ctx.currentValue.note,
                info: ctx => ctx.currentValue,
              },
            ),
          },
        },
        verifications: {
          children: {
            '{verificationIndex}': attributeMapping(
              'ResourceStringAttributes',
              'verifications/{verificationIndex}',
              {
                value: ctx => ctx.currentValue.name,
                info: ctx => ctx.currentValue,
              },
            ),
          },
        },
        social: {
          children: {
            '{app}': attributeMapping('ResourceStringAttributes', siteKey('social/{app}')),
          },
        },
        legalStatus: attributeMapping('ResourceStringAttributes', siteKey('legalStatus')),
        khpReferenceNumber: attributeMapping(
          'ResourceNumberAttributes',
          siteKey('khpReferenceNumber'),
        ),
        agencyReferenceNumber: attributeMapping(
          'ResourceStringAttributes',
          siteKey('agencyReferenceNumber'),
        ),
        agency: {
          children: {
            '{language}': translatableAttributeMapping(siteKey('agency'), {
              value: ctx => ctx.currentValue.alternate,
              info: ctx => ctx.currentValue,
              language: ctx => ctx.captures.language,
            }),
          },
        },
        nameEN: translatableAttributeMapping('name', { language: 'en' }),
        nameFR: translatableAttributeMapping('name', { language: 'fr' }),
        nameDetails: {
          children: {
            '{language}': translatableAttributeMapping(siteKey('nameDetails'), {
              value: ctx => ctx.currentValue.alternate,
              language: ctx => ctx.captures.language,
              info: ctx => ctx.currentValue,
            }),
          },
        },
        isActive: attributeMapping('ResourceBooleanAttributes', siteKey('isActive')),
        isLocationPrivate: attributeMapping(
          'ResourceBooleanAttributes',
          siteKey('isLocationPrivate'),
        ),
        location: {
          children: {
            address1: attributeMapping('ResourceStringAttributes', siteKey('location/address1')),
            address2: attributeMapping('ResourceStringAttributes', siteKey('location/address2')),
            city: referenceAttributeMapping(siteKey('location/city'), 'cities', {
              value: ctx => ctx.currentValue,
            }),
            county: referenceAttributeMapping(siteKey('location/county'), 'counties', {
              value: ctx => ctx.currentValue,
            }),
            province: referenceAttributeMapping(siteKey('location/province'), 'provinces', {
              value: ctx => ctx.currentValue,
            }),
            country: referenceAttributeMapping(siteKey('location/country'), 'countries', {
              value: ctx => ctx.currentValue,
            }),
            postalCode: attributeMapping(
              'ResourceStringAttributes',
              siteKey('location/postalCode'),
            ),
            description: attributeMapping(
              'ResourceStringAttributes',
              siteKey('location/description'),
            ),
            longitude: attributeMapping('ResourceNumberAttributes', 'location/longitude'),
            latitude: attributeMapping('ResourceNumberAttributes', 'location/latitude'),
          },
        },
        mailingAddress: {
          children: {
            address1: attributeMapping('ResourceStringAttributes', siteKey('location/address1')),
            address2: attributeMapping('ResourceStringAttributes', siteKey('location/address2')),
            city: referenceAttributeMapping(siteKey('location/city'), 'cities', {
              value: ctx => ctx.currentValue,
            }),
            county: referenceAttributeMapping(siteKey('location/county'), 'counties', {
              value: ctx => ctx.currentValue,
            }),
            province: referenceAttributeMapping(siteKey('location/province'), 'provinces', {
              value: ctx => ctx.currentValue,
            }),
            country: referenceAttributeMapping(siteKey('location/country'), 'countries', {
              value: ctx => ctx.currentValue,
            }),
            postalCode: attributeMapping(
              'ResourceStringAttributes',
              siteKey('location/postalCode'),
            ),
          },
        },
        operations: {
          children: {
            '{dayIndex}': {
              children: {
                '{language}': translatableAttributeMapping(siteKey('operations/{dayIndex}'), {
                  value: ctx => ctx.currentValue.day,
                  info: ctx => ctx.currentValue,
                  language: ctx => ctx.captures.language,
                }),
              },
            },
          },
        },
        accessibility: {
          children: {
            '{language}': translatableAttributeMapping(siteKey('accessibility'), {
              language: ctx => ctx.captures.language,
            }),
          },
        },
        transportation: {
          children: {
            '{language}': translatableAttributeMapping(siteKey('transportation'), {
              language: ctx => ctx.captures.language,
            }),
          },
        },
        email: attributeMapping('ResourceStringAttributes', siteKey('email')),
        website: {
          children: {
            '{language}': translatableAttributeMapping(siteKey('website'), {
              language: ctx => ctx.captures.language,
            }),
          },
        },
        phoneNumbers: {
          children: {
            '{phoneNumberType}': attributeMapping(
              'ResourceStringAttributes',
              siteKey('phone/{phoneNumberType}'),
              {
                value: ctx => ctx.currentValue.name || ctx.currentValue.number,
                info: ctx => ctx.currentValue,
              },
            ),
          },
        },
        contacts: {
          children: {
            '{contactIndex}': attributeMapping(
              'ResourceStringAttributes',
              siteKey('contacts/{contactIndex}'),
              {
                value: ctx => ctx.currentValue.name,
                info: ctx => ctx.currentValue,
              },
            ),
          },
        },
        retiredAt: attributeMapping('ResourceDateTimeAttributes', siteKey('retiredAt')),
        createdAt: attributeMapping('ResourceDateTimeAttributes', siteKey('createdAt')),
        updatedAt: attributeMapping('ResourceDateTimeAttributes', siteKey('updatedAt')),
      },
    },
  },
};

// TODO: this is an array of arrays, is this shape correct?
const KHP_MAPPING_NODE_TAXONOMIES: { children: MappingNode } = {
  children: {
    '{arrayIndex}': {
      children: {
        '{taxonomyIndex}': referenceAttributeMapping(
          'taxonomies/{arrayIndex}/{taxonomyIndex}',
          'khp-taxonomy-codes',
          { value: ctx => ctx.currentValue.code },
        ),
      },
    },
  },
};

export const KHP_MAPPING_NODE: MappingNode = {
  khpReferenceNumber: resourceFieldMapping('id'),
  sites: KHP_MAPPING_NODE_SITES,
  taxonomies: KHP_MAPPING_NODE_TAXONOMIES,
  name: resourceFieldMapping('name', ctx => ctx.currentValue.en || ctx.currentValue.fr),
  updatedAt: resourceFieldMapping('updatedAt'),
  createdAt: attributeMapping('ResourceDateTimeAttributes', 'sourceCreatedAt'),
  retiredAt: attributeMapping('ResourceDateTimeAttributes', 'sourceRetiredAt'),
  nameDetails: {
    children: {
      '{language}': translatableAttributeMapping('nameDetails', {
        value: ctx => ctx.currentValue.official || ctx.currentValue.alternate,
        info: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  applicationProcess: {
    children: {
      '{language}': translatableAttributeMapping('applicationProcess', {
        language: ctx => ctx.captures.language,
      }),
    },
  },
  capacity: {
    children: {
      '{language}': translatableAttributeMapping('capacity', {
        value: ctx => ctx.currentValue.value,
        info: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  social: {
    children: {
      '{app}': attributeMapping('ResourceStringAttributes', siteKey('social/{app}')),
    },
  },
  eligibilityDetails: {
    children: {
      phrase: {
        children: {
          '{language}': translatableAttributeMapping('phrase', {
            language: ctx => ctx.captures.language,
          }),
        },
      },
      adult: attributeMapping('ResourceBooleanAttributes', 'adult'),
      child: attributeMapping('ResourceBooleanAttributes', 'child'),
      family: attributeMapping('ResourceBooleanAttributes', 'family'),
      teen: attributeMapping('ResourceBooleanAttributes', 'teen'),
      gender: attributeMapping('ResourceStringAttributes', 'gender'),
    },
  },
  website: {
    children: {
      '{language}': translatableAttributeMapping('website', {
        language: ctx => ctx.captures.language,
      }),
    },
  },
  metadata: {
    children: {
      isHotline: attributeMapping('ResourceBooleanAttributes', 'isHotline'),
      isHelpline: attributeMapping('ResourceBooleanAttributes', 'isHelpline'),
      '{language}': {
        children: {
          '{property}': translatableAttributeMapping('metadata/{property}', {
            info: ctx => ctx.currentValue,
            language: ctx => ctx.captures.language,
          }),
        },
      },
    },
  },
  transportation: {
    children: {
      '{language}': translatableAttributeMapping('transportation', {
        language: ctx => ctx.captures.language,
      }),
    },
  },
  seniorOrgContact: {
    children: {
      title: {
        children: {
          '{language}': translatableAttributeMapping('seniorOrgContact', {
            language: ctx => ctx.captures.language,
          }),
        },
      },
      isPrivate: attributeMapping('ResourceBooleanAttributes', 'isPrivate', {}),
      name: attributeMapping('ResourceStringAttributes', 'name', {}),
      // I'm assuming this one, since it's always null
      email: attributeMapping('ResourceStringAttributes', 'email', {}),
      // I'm assuming this one, since it's always "false" (no, not false, string "false")
      phone: attributeMapping('ResourceStringAttributes', 'phone', {}),
    },
  },
  recordType: attributeMapping('ResourceStringAttributes', 'recordType'),
  feeStructureSourceFreeText: attributeMapping(
    'ResourceStringAttributes',
    'feeStructureSourceFreeText',
  ),
  feeStructureSourceFreeTextEn: attributeMapping(
    'ResourceStringAttributes',
    'feeStructureSourceFreeTextEn',
  ),
  feeStructureSourceFreeTextFr: attributeMapping(
    'ResourceStringAttributes',
    'feeStructureSourceFreeTextFr',
  ),
  howToAccessSupport: referenceAttributeMapping('howToAccessSupport', 'khp-how-to-access-support', {
    // W use objectId or the name for this referrable resources?
    value: ctx => ctx.currentValue.objectId,
    // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
  }),
  isHighlighted: attributeMapping('ResourceBooleanAttributes', 'isHighlighted'),
  // This is an array of strings. Is this shape better or we want the individual strings as attributes?
  keywords: attributeMapping('ResourceStringAttributes', 'keywords', {
    value: ctx => ctx.currentValue.join(' '),
    info: ctx => ({ keywords: ctx.currentValue }),
  }),
  notes: {
    children: {
      '{noteIndex}': attributeMapping('ResourceStringAttributes', siteKey('notes/{noteIndex}'), {
        value: ctx => ctx.currentValue.note,
        info: ctx => ctx.currentValue,
      }),
    },
  },
  // This are objects. Are we fine treating the note as string and the rest in info, or better to separate in attributes?
  verifications: {
    children: {
      '{verificationIndex}': attributeMapping(
        'ResourceStringAttributes',
        'verifications/{verificationIndex}',
        {
          value: ctx => ctx.currentValue.name,
          info: ctx => ctx.currentValue,
        },
      ),
    },
  },
  agency: {
    children: {
      '{language}': translatableAttributeMapping(siteKey('agency'), {
        value: ctx => ctx.currentValue.alternate,
        info: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  lastVerifiedOn: attributeMapping('ResourceStringAttributes', 'lastVerifiedOn', {
    value: ctx => ctx.currentValue,
  }),
  description: {
    children: {
      '{language}': translatableAttributeMapping('description', {
        // TODO: this was previously mapped as 'description' (string). Was that intended?
        info: context => ({ text: context.currentValue }),
        language: ctx => ctx.captures.language,
      }),
    },
  },
  isActive: attributeMapping('ResourceBooleanAttributes', 'isActive', {
    value: ctx => ctx.currentValue,
  }),
  mailingAddresses: {
    children: {
      '{addressIndex}': {
        children: {
          address1: attributeMapping(
            'ResourceStringAttributes',
            'mailingAddresses/{addressIndex}/address1',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          address2: attributeMapping(
            'ResourceStringAttributes',
            'mailingAddresses/{addressIndex}/address2',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          isPrivate: attributeMapping(
            'ResourceBooleanAttributes',
            'mailingAddresses/{addressIndex}/isActive',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          city: referenceAttributeMapping('mailingAddresses/{addressIndex}/city', 'cities', {
            value: ctx => {
              const { city, province, country } = ctx.currentValue;
              return [country, province, city].join('/');
            },
          }),
          province: referenceAttributeMapping(
            'mailingAddresses/{addressIndex}/province',
            'provinces',
            {
              value: ctx => {
                const { province, country } = ctx.currentValue;
                return [country, province].join('/');
              },
            },
          ),
          country: referenceAttributeMapping(
            'mailingAddresses/{addressIndex}/country',
            'countries',
            {
              value: ctx => ctx.currentValue.country,
            },
          ),
          postalCode: attributeMapping(
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
          address1: attributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/address1',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          address2: attributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/address2',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          isPrivate: attributeMapping(
            'ResourceBooleanAttributes',
            'physicalAddresses/{addressIndex}/isActive',
            {
              value: ctx => ctx.currentValue,
            },
          ),
          city: referenceAttributeMapping('physicalAddresses/{addressIndex}/city', 'cities', {
            value: ctx => {
              const { city, county, province, country } = ctx.currentValue;
              return [country, province, county, city].join('/');
            },
          }),
          county: attributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/country',
          ),
          province: referenceAttributeMapping(
            'physicalAddresses/{addressIndex}/province',
            'provinces',
            {
              value: ctx => {
                const { province, country } = ctx.currentValue;
                return [country, province].join('/');
              },
            },
          ),
          country: referenceAttributeMapping(
            'physicalAddresses/{addressIndex}/country',
            'countries',
            {
              value: ctx => ctx.currentValue.country,
            },
          ),
          postalCode: attributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/postalCode',
          ),
          description: attributeMapping(
            'ResourceStringAttributes',
            'physicalAddresses/{addressIndex}/description',
          ),
          longitude: attributeMapping(
            'ResourceNumberAttributes',
            'physicalAddresses/{addressIndex}/longitude',
          ),
          latitude: attributeMapping(
            'ResourceNumberAttributes',
            'physicalAddresses/{addressIndex}/latitude',
          ),
        },
      },
    },
  },
  primaryLocationCity: referenceAttributeMapping('primaryLocationCity', 'cities', {
    value: ctx => {
      const { primaryLocationProvince } = ctx.rootResource;
      // TODO: No top level country, assumes always CA?
      return ['CA', primaryLocationProvince, ctx.currentValue].join('/');
    },
  }),
  primaryLocationCounty: referenceAttributeMapping('primaryLocationCounty', 'counties', {
    value: ctx => {
      const { primaryLocationProvince } = ctx.rootResource;
      // TODO: No top level country, assumes always CA?
      return ['CA', primaryLocationProvince, ctx.currentValue].join('/');
    },
  }),
  primaryLocationProvince: referenceAttributeMapping('primaryLocationProvince', 'provinces', {
    value: ctx => {
      // TODO: No top level country, assumes always CA?
      return ['CA', ctx.currentValue].join('/');
    },
  }),
  primaryLocationPostalCode: attributeMapping(
    'ResourceStringAttributes',
    'primaryLocationPostalCode',
  ),
  primaryLocationAddress1: attributeMapping('ResourceStringAttributes', 'primaryLocationAddress1'),
  primaryLocationAddress2: attributeMapping('ResourceStringAttributes', 'primaryLocationAddress2'),
  primaryLocationPhone: attributeMapping('ResourceStringAttributes', 'primaryLocationPhone'),
  primaryLocationIsPrivate: attributeMapping(
    'ResourceBooleanAttributes',
    'primaryLocationIsPrivate',
  ),
  coverage: {
    children: {
      '{language}': translatableAttributeMapping('coverage', {
        value: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  targetPopulations: {
    children: {
      '{targetPopulationIndex}': referenceAttributeMapping(
        'targetPopulation/{targetPopulationIndex}',
        'khp-target-populations',
        {
          // We use objectId or the name for this referrable resources?
          value: ctx => ctx.currentValue.objectId,
          // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
        },
      ),
    },
  },
  eligibilityMinAge: attributeMapping('ResourceNumberAttributes', 'eligibilityMinAge', {
    value: ctx => ctx.currentValue,
  }),
  eligibilityMaxAge: attributeMapping('ResourceNumberAttributes', 'eligibilityMaxAge', {
    value: ctx => ctx.currentValue,
  }),
  phoneNumbers: {
    children: {
      '{phoneNumberIndex}': attributeMapping(
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
      name: attributeMapping('ResourceStringAttributes', 'mainContact/name'),
      email: attributeMapping('ResourceStringAttributes', 'mainContact/email'),
      title: {
        children: {
          '{language}': translatableAttributeMapping('mainContact/title', {
            language: context => context.captures.language,
          }),
        },
      },
      phone: attributeMapping('ResourceStringAttributes', 'mainContact/phone'),
      isPrivate: attributeMapping('ResourceBooleanAttributes', 'mainContact/isPrivate'),
    },
  },
  documentsRequired: {
    children: {
      '{documentIndex}': translatableAttributeMapping('documentsRequired/{documentIndex}', {
        value: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
  paymentMethod: attributeMapping('ResourceStringAttributes', 'paymentMethod'),
  operations: {
    children: {
      '{dayIndex}': {
        children: {
          '{language}': translatableAttributeMapping('operations/{dayIndex}', {
            value: context => context.currentValue.day,
            info: context => context.currentValue,
            language: context => context.captures.language,
          }),
        },
      },
    },
  },
  languages: {
    children: {
      '{languageIndex}': referenceAttributeMapping('languages/{languageIndex}', 'khp-languages', {
        value: context => context.currentValue.language,
      }),
    },
  },
  interpretationTranslationServicesAvailable: attributeMapping(
    'ResourceBooleanAttributes',
    'interpretationTranslationServicesAvailable',
  ),
  available247: attributeMapping('ResourceBooleanAttributes', 'available247'),
  feeStructureSource: referenceAttributeMapping('feeStructureSource', 'khp-fee-structure-source', {
    // We use objectId or the name for this referrable resources?
    value: ctx => ctx.currentValue.objectId,
    // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
  }),
  howIsServiceOffered: referenceAttributeMapping(
    'howIsServiceOffered',
    'khp-how-is-service-offered',
    {
      // We use objectId or the name for this referrable resources?
      value: ctx => ctx.currentValue.objectId,
      // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
    },
  ),
  accessibility: referenceAttributeMapping('accessibility', 'khp-accessibility', {
    // We use objectId or the name for this referrable resources?
    value: ctx => ctx.currentValue.objectId,
    // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
  }),
  volunteer: {
    children: {
      '{language}': translatableAttributeMapping('volunteer', {
        value: ctx => ctx.currentValue.opportunities,
        info: ctx => ctx.currentValue,
        language: ctx => ctx.captures.language,
      }),
    },
  },
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
