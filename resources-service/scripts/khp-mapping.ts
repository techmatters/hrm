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
  khpAttributeMapping,
  KhpMappingNode,
  khpReferenceAttributeMapping,
  khpResourceFieldMapping,
  khpTranslatableAttributeMapping,
  substitueCaptureTokens,
} from './khp-aselo-converter';

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
 * This defines all the mapping logic for a converting KHP resource to an Aselo resource.
 * The mapping is defined as a tree of nodes, where each node represents a field in the Aselo resource.
 * If the content of this node needs to be written to the Aselo DB, it should be provided a khpFieldMapping, khpAttributeMapping, or khpReferenceAttributeMapping function, depending on where the data should be written.
 * Child nodes are defined with the `children` property.
 * If the names of the child nodes are dynamic, e.g. one per language, or one per social media channel, the node should be named with a placeholder token, e.g. '{language}' or '{channel}'. This will make the importer process all child data nodes and capture their property under `captures` property of the context object for use generating keys, values & info etc..
 */
export const KHP_MAPPING_NODE: KhpMappingNode = {
  resourceID: khpResourceFieldMapping('id'),
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
              province: khpReferenceAttributeMapping(
                siteKey('location/province'),
                'canadian-provinces',
              ),
              country: khpReferenceAttributeMapping(siteKey('location/country'), 'khp-countries'),
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
  name: khpResourceFieldMapping('name', context => context.currentValue.en),
  nameDetails: {
    children: {
      '{language}': khpTranslatableAttributeMapping('nameDetails', {
        value: ctx => ctx.currentValue.official,
        info: context => context.currentValue,
        language: context => context.captures.language,
      }),
    },
  },
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
  phoneNumbers: {
    children: {
      '{phoneNumberIndex}': khpAttributeMapping(
        'ResourceStringAttributes',
        ctx => `phoneNumbers/${ctx.currentValue.type ?? ctx.captures.phoneNumberIndex}`,
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
      phoneNumber: khpAttributeMapping('ResourceStringAttributes', 'mainContact/phoneNumber'),
      isPrivate: khpAttributeMapping('ResourceBooleanAttributes', 'mainContact/isPrivate'),
    },
  },
  website: khpAttributeMapping('ResourceStringAttributes', 'website'),
  status: khpReferenceAttributeMapping('status', 'khp-resource-statuses'),
  description: {
    children: {
      '{language}': khpTranslatableAttributeMapping('description', {
        value: 'description',
        info: context => ({ text: context.currentValue }),
        language: context => context.captures.language,
      }),
    },
  },
  primaryLocationCity: khpAttributeMapping('ResourceStringAttributes', 'primaryLocationCity'),
  primaryLocationCounty: khpAttributeMapping('ResourceStringAttributes', 'primaryLocationCounty'),
  primaryLocationProvince: khpReferenceAttributeMapping(
    'primaryLocationProvince',
    'canadian-provinces',
  ),
  primaryLocationPostalCode: khpAttributeMapping(
    'ResourceStringAttributes',
    'primaryLocationPostalCode',
  ),
  primaryLocationPhone: khpAttributeMapping('ResourceStringAttributes', 'primaryLocationPhone'),
  primaryLocationIsPrivate: khpAttributeMapping(
    'ResourceBooleanAttributes',
    'primaryLocationIsPrivate',
  ),
  targetPopulations: {
    children: {
      '{targetPopulationIndex}': khpReferenceAttributeMapping(
        'targetPopulation/{targetPopulationIndex}',
        'khp-target-populations',
      ),
    },
  },
  eligibilityMinAge: khpAttributeMapping('ResourceNumberAttributes', 'eligibilityMinAge'),
  eligibilityMaxAge: khpAttributeMapping('ResourceNumberAttributes', 'eligibilityMaxAge'),
  interpretationTranslationServicesAvailable: khpAttributeMapping(
    'ResourceBooleanAttributes',
    'interpretationTranslationServicesAvailable',
  ),
  feeStructureSource: khpReferenceAttributeMapping(
    'feeStructureSource',
    'khp-fee-structure-source',
  ),
  howToAccessSupport: khpReferenceAttributeMapping(
    'howToAccessSupport',
    'khp-how-to-access-support',
  ),
  howIsServiceOffered: khpReferenceAttributeMapping(
    'howIsServiceOffered',
    'khp-how-is-service-offered',
  ),
  keywords: khpAttributeMapping('ResourceStringAttributes', 'keywords', {
    value: ctx => ctx.currentValue.join(' '),
    info: ctx => ({ keywords: ctx.currentValue }),
  }),
  accessibility: khpReferenceAttributeMapping('accessibility', 'khp-accessibility'),
  applicationProcess: khpReferenceAttributeMapping('applicationProcess', 'khp-application-process'),
  documentsRequired: {
    children: {
      '{documentIndex}': khpAttributeMapping(
        'ResourceStringAttributes',
        'documentsRequired/{documentIndex}',
      ),
    },
  },
  languages: khpReferenceAttributeMapping('languages', 'khp-languages', {
    value: context => context.currentValue.language,
  }),
  available247: khpAttributeMapping('ResourceBooleanAttributes', 'available247'),
  isPrivate: khpAttributeMapping('ResourceBooleanAttributes', 'isPrivate'),
  taxonomyCode: khpAttributeMapping('ResourceStringAttributes', 'taxonomyCode'),
  timestamps: {
    children: {
      createdAt: khpAttributeMapping('ResourceDateTimeAttributes', 'sourceCreatedAt'),
      updatedAt: khpAttributeMapping('ResourceDateTimeAttributes', 'sourceUpdatedAt'),
    },
  },
};

export const KHP_RESOURCE_REFERENCES = {
  'canadian-provinces': [
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
  'khp-countries': [
    {
      id: 'Canada',
      value: 'Canada',
      info: null,
    },
  ],
  'khp-cities': [
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
  'khp-application-process': [
    {
      id: 'Submit form in-person',
      value: 'Submit form in-person',
      info: null,
    },
    {
      id: 'Self Referral',
      value: 'Self Referral',
      info: null,
    },
    {
      id: 'Unknown',
      value:
        'Application process unknown. A step in the right direction would be to call or email to connect and learn more.',
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
