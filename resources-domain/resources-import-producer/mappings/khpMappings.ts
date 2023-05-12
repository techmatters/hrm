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
export const KHP_MAPPING_NODE: MappingNode = {
  khpReferenceNumber: resourceFieldMapping('id'),
  // TODO: revisit this since it's all empty in the samples
  sites: {
    children: {
      '{siteIndex}': {
        children: {
          name: {
            children: {
              '{language}': translatableAttributeMapping(siteKey('name'), {
                language: ctx => ctx.captures.language,
              }),
            },
          },
          details: {
            children: {
              '{language}': translatableAttributeMapping(siteKey('details'), {
                value: siteKey('details'),
                info: ctx => ctx.currentValue,
                language: ctx => ctx.captures.language,
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
              city: attributeMapping('ResourceStringAttributes', siteKey('location/city')),
              county: attributeMapping('ResourceStringAttributes', siteKey('location/county')),
              // TODO: need a sample to see what we use as id here
              // province: referenceAttributeMapping(siteKey('location/province'), 'provinces'),
              // country: referenceAttributeMapping(siteKey('location/country'), 'countries'),
              postalCode: attributeMapping(
                'ResourceStringAttributes',
                siteKey('location/postalCode'),
              ),
            },
          },
          email: attributeMapping('ResourceStringAttributes', siteKey('email')),
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
          phoneNumbers: {
            children: {
              '{phoneNumberType}': attributeMapping(
                'ResourceStringAttributes',
                siteKey('phone/{phoneNumberType}'),
              ),
            },
          },
        },
      },
    },
  },
  name: resourceFieldMapping('name', ctx => ctx.currentValue.en || ctx.currentValue.fr),
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
        value: ctx => ctx.currentValue,
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
  // TODO: this are all null in the samples, I don't know what to map to
  // social: {
  //   children: {

  //   }
  // }
  eligibilityDetails: {
    children: {
      phrase: {
        children: {
          '{language}': translatableAttributeMapping('phrase', {
            value: ctx => ctx.currentValue,
            language: ctx => ctx.captures.language,
          }),
        },
      },
    },
  },
  website: {
    children: {
      '{language}': translatableAttributeMapping('website', {
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
          '{property}': translatableAttributeMapping('metadata/{property}', {
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
  //     '{language}': translatableAttributeMapping('transportation', {

  //     })
  //   }
  // }
  seniorOrgContact: {
    children: {
      title: {
        children: {
          '{language}': translatableAttributeMapping('seniorOrgContact', {
            value: ctx => ctx.currentValue,
            language: ctx => ctx.captures.language,
          }),
        },
      },
      isPrivate: attributeMapping('ResourceBooleanAttributes', 'isPrivate', {
        value: ctx => ctx.currentValue,
      }),
      name: attributeMapping('ResourceStringAttributes', 'name', {
        value: ctx => ctx.currentValue,
      }),
      // I'm assuming this one, since it's always null
      email: attributeMapping('ResourceStringAttributes', 'email', {
        value: ctx => ctx.currentValue,
      }),
      // I'm assuming this one, since it's always "false" (no, not false, string "false")
      phone: attributeMapping('ResourceStringAttributes', 'phone', {
        value: ctx => ctx.currentValue,
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
        value: ctx => ctx.currentValue,
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
  // TODO: need samples to see what to sue as value
  // targetPopulations: {
  //   children: {
  //     '{targetPopulationIndex}': referenceAttributeMapping(
  //       'targetPopulation/{targetPopulationIndex}',
  //       'khp-target-populations',
  //     ),
  //   },
  // },
  // TODO: this is always an empty array
  // targetPopulations: {
  //   children: {

  //   }
  // }
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
  // TODO: this is null in all the samples
  // paymentMethod: {

  // }
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
  // TODO: this is an array. Should we instead map like languages: { chidlren: { ... }}?
  languages: referenceAttributeMapping('languages', 'khp-languages', {
    value: context => context.currentValue.language,
  }),
  interpretationTranslationServicesAvailable: attributeMapping(
    'ResourceBooleanAttributes',
    'interpretationTranslationServicesAvailable',
  ),
  available247: attributeMapping('ResourceBooleanAttributes', 'available247'),
  feeStructureSource: referenceAttributeMapping('feeStructureSource', 'khp-fee-structure-source', {
    // TODO: we use objectId or the name for this referrable resources?
    value: ctx => ctx.currentValue.objectId,
    // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
  }),
  howIsServiceOffered: referenceAttributeMapping(
    'howIsServiceOffered',
    'khp-how-is-service-offered',
    {
      // TODO: we use objectId or the name for this referrable resources?
      value: ctx => ctx.currentValue.objectId,
      // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
    },
  ),
  accessibility: referenceAttributeMapping('accessibility', 'khp-accessibility', {
    // TODO: we use objectId or the name for this referrable resources?
    value: ctx => ctx.currentValue.objectId,
    // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
  }),
  howToAccessSupport: referenceAttributeMapping('howToAccessSupport', 'khp-how-to-access-support', {
    // TODO: we use objectId or the name for this referrable resources?
    value: ctx => ctx.currentValue.objectId,
    // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
  }),
  isHighlighted: attributeMapping('ResourceBooleanAttributes', 'isHighlighted', {
    value: ctx => ctx.currentValue,
  }),
  keywords: attributeMapping('ResourceStringAttributes', 'keywords', {
    value: ctx => ctx.currentValue.join(' '),
    info: ctx => ({ keywords: ctx.currentValue }),
  }),
  createdAt: attributeMapping('ResourceDateTimeAttributes', 'sourceCreatedAt'),
  updatedAt: resourceFieldMapping('updatedAt'),
  retiredAt: attributeMapping('ResourceDateTimeAttributes', 'sourceRetiredAt'),
  // TODO: this is an array of arrays, is this shape correct?
  taxonomies: {
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
  },
  // TODO: this is an empty array
  // notes: {

  // }
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
  // TODO: this one is absent in the new sample
  // status: referenceAttributeMapping('status', 'khp-resource-statuses'),
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
