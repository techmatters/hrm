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
  substituteCaptureTokens,
  resourceFieldMapping,
  attributeMapping,
  translatableAttributeMapping,
  referenceAttributeMapping,
} from './mappers';

// TODO: Change objectId to site ID when we have it
const siteKey = (subsection: string) => (context: FieldMappingContext) => {
  const {
    rootResource,
    captures: { siteIndex },
  } = context;
  return `site/${rootResource.sites[siteIndex].objectId}/${substituteCaptureTokens(
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
              'stringAttributes',
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
              'stringAttributes',
              siteKey('verifications/{verificationIndex}'),
              {
                value: ctx => ctx.currentValue.name,
                info: ctx => ctx.currentValue,
              },
            ),
          },
        },
        social: {
          children: {
            '{app}': attributeMapping('stringAttributes', siteKey('social/{app}')),
          },
        },
        legalStatus: attributeMapping('stringAttributes', siteKey('legalStatus')),
        khpReferenceNumber: attributeMapping(
          'numberAttributes',
          siteKey('khpReferenceNumber'),
        ),
        agencyReferenceNumber: attributeMapping(
          'stringAttributes',
          siteKey('agencyReferenceNumber'),
        ),
        nameEN: translatableAttributeMapping(siteKey('name'), { language: 'en' }),
        nameFR: translatableAttributeMapping(siteKey('name'), { language: 'fr' }),
        nameDetails: {
          children: {
            '{language}': translatableAttributeMapping(siteKey('nameDetails'), {
              value: ctx => ctx.currentValue.alternate,
              language: ctx => ctx.captures.language,
              info: ctx => ctx.currentValue,
            }),
          },
        },
        isActive: attributeMapping('booleanAttributes', siteKey('isActive')),
        location: {
          children: {
            address1: translatableAttributeMapping(siteKey('location/address1')),
            address2: translatableAttributeMapping(siteKey('location/address2')),
            city: referenceAttributeMapping(siteKey('location/city'), 'cities', {
              value: ctx => `CA/${ctx.parentValue.province}/${ctx.currentValue}`,
            }),
            county: translatableAttributeMapping(siteKey('location/county'), {
              value: ctx => ctx.currentValue,
            }),
            province: referenceAttributeMapping(
              siteKey('location/province'),
              'provinces',
              {
                value: ctx => `CA/${ctx.currentValue}`,
              },
            ),
            country: translatableAttributeMapping(siteKey('location/country'), {
              value: ctx => ctx.currentValue,
            }),
            postalCode: translatableAttributeMapping(siteKey('location/postalCode')),
            description: translatableAttributeMapping(siteKey('location/description')),
            longitude: attributeMapping(
              'numberAttributes',
              siteKey('location/longitude'),
            ),
            latitude: attributeMapping('numberAttributes', siteKey('location/latitude')),
          },
        },
        operations: {
          children: {
            '{dayIndex}': {
              children: {
                '{language}': translatableAttributeMapping(
                  siteKey('operations/{dayIndex}'),
                  {
                    value: ctx => ctx.currentValue.day,
                    info: ctx => ctx.currentValue,
                    language: ctx => ctx.captures.language,
                  },
                ),
                _id: {},
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
        email: attributeMapping('stringAttributes', siteKey('email')),
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
              'stringAttributes',
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
              'stringAttributes',
              siteKey('contacts/{contactIndex}'),
              {
                value: ctx => ctx.currentValue.name,
                info: ctx => ctx.currentValue,
              },
            ),
          },
        },
        retiredAt: attributeMapping('dateTimeAttributes', siteKey('retiredAt')),
        createdAt: attributeMapping('dateTimeAttributes', siteKey('createdAt')),
        updatedAt: attributeMapping('dateTimeAttributes', siteKey('updatedAt')),
        objectId: attributeMapping('stringAttributes', siteKey('siteId')),
      },
    },
  },
};

// TODO: this is an array of arrays, is this shape correct?
const KHP_MAPPING_NODE_TAXONOMIES: { children: MappingNode } = {
  children: {
    '{arrayIndex}': {
      children: {
        '{taxonomyIndex}': {
          children: {
            nameEN: translatableAttributeMapping(
              'taxonomies/{arrayIndex}/{taxonomyIndex}',
              {
                value: ctx => ctx.currentValue,
                language: 'en',
                info: ctx => ctx.parentValue,
              },
            ),
            nameFR: translatableAttributeMapping(
              'taxonomies/{arrayIndex}/{taxonomyIndex}',
              {
                value: ctx => ctx.currentValue,
                language: 'fr',
                info: ctx => ctx.parentValue,
              },
            ),
          },
        },
      },
    },
  },
};

export const KHP_MAPPING_NODE: MappingNode = {
  objectId: resourceFieldMapping('id'),
  timeSequence: resourceFieldMapping('importSequenceId'),
  sites: KHP_MAPPING_NODE_SITES,
  taxonomies: KHP_MAPPING_NODE_TAXONOMIES,
  name: resourceFieldMapping('name', ctx => ctx.currentValue.en || ctx.currentValue.fr),
  updatedAt: resourceFieldMapping('lastUpdated'),
  createdAt: attributeMapping('dateTimeAttributes', 'sourceCreatedAt'),
  retiredAt: resourceFieldMapping('deletedAt'),
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
      '{app}': attributeMapping('stringAttributes', 'social/{app}'),
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
      adult: attributeMapping('booleanAttributes', 'adult'),
      child: attributeMapping('booleanAttributes', 'child'),
      family: attributeMapping('booleanAttributes', 'family'),
      teen: attributeMapping('booleanAttributes', 'teen'),
      gender: attributeMapping('stringAttributes', 'gender'),
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
      isHotline: attributeMapping('booleanAttributes', 'isHotline'),
      isHelpline: attributeMapping('booleanAttributes', 'isHelpline'),
      '{language}': {
        children: {
          '{property}': translatableAttributeMapping('metadata/{property}', {
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
      isPrivate: attributeMapping('booleanAttributes', 'isPrivate'),
      name: attributeMapping('stringAttributes', 'name'),
      // I'm assuming this one, since it's always null
      email: attributeMapping('stringAttributes', 'email'),
      // I'm assuming this one, since it's always "false" (no, not false, string "false")
      phone: attributeMapping('stringAttributes', 'phone'),
    },
  },
  recordType: attributeMapping('stringAttributes', 'recordType'),
  feeStructureSourceFreeText: attributeMapping(
    'stringAttributes',
    'feeStructureSourceFreeText',
  ),
  feeStructureSourceFreeTextEn: attributeMapping(
    'stringAttributes',
    'feeStructureSourceFreeTextEn',
  ),
  feeStructureSourceFreeTextFr: attributeMapping(
    'stringAttributes',
    'feeStructureSourceFreeTextFr',
  ),
  howToAccessSupport: {
    children: {
      '{howToAccessSupportIndex}': {
        children: {
          objectId: { children: {} },
          '{language}': translatableAttributeMapping(
            'howToAccessSupport/{howToAccessSupportIndex}',
            {
              language: ctx => ctx.captures.language,
            },
          ),
        },
      },
    },
  },
  isHighlighted: attributeMapping('booleanAttributes', 'isHighlighted'),
  // This is an array of strings. Is this shape better or we want the individual strings as attributes?
  keywords: attributeMapping('stringAttributes', 'keywords', {
    value: ctx => ctx.currentValue.join(' '),
    info: ctx => ({ keywords: ctx.currentValue }),
  }),
  notes: {
    children: {
      '{noteIndex}': attributeMapping('stringAttributes', 'notes/{noteIndex}', {
        value: ctx => ctx.currentValue.note,
        info: ctx => ctx.currentValue,
      }),
    },
  },
  // This are objects. Are we fine treating the note as string and the rest in info, or better to separate in attributes?
  verifications: {
    children: {
      '{verificationIndex}': attributeMapping(
        'stringAttributes',
        'verifications/{verificationIndex}',
        {
          value: ctx => ctx.currentValue.name,
          info: ctx => ctx.currentValue,
        },
      ),
    },
  },
  lastVerifiedOn: attributeMapping('stringAttributes', 'lastVerifiedOn', {
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
  isActive: attributeMapping('booleanAttributes', 'isActive', {
    value: ctx => ctx.currentValue,
  }),
  primaryLocationCity: referenceAttributeMapping('primaryLocationCity', 'cities', {
    value: ctx => {
      const { primaryLocationProvince } = ctx.rootResource;
      // TODO: No top level country, assumes always CA?
      return ['CA', primaryLocationProvince, ctx.currentValue].join('/');
    },
  }),
  primaryLocationCounty: attributeMapping('stringAttributes', 'primaryLocationCounty'),
  primaryLocationProvince: referenceAttributeMapping(
    'primaryLocationProvince',
    'provinces',
    {
      value: ctx => {
        // TODO: No top level country, assumes always CA?
        return ['CA', ctx.currentValue].join('/');
      },
    },
  ),
  primaryLocationPostalCode: attributeMapping(
    'stringAttributes',
    'primaryLocationPostalCode',
  ),
  primaryLocationAddress1: attributeMapping(
    'stringAttributes',
    'primaryLocationAddress1',
  ),
  primaryLocationAddress2: attributeMapping(
    'stringAttributes',
    'primaryLocationAddress2',
  ),
  primaryLocationPhone: attributeMapping('stringAttributes', 'primaryLocationPhone'),
  primaryLocationIsPrivate: attributeMapping(
    'booleanAttributes',
    'primaryLocationIsPrivate',
  ),
  coverage: {
    children: {
      '{coverageIndex}': translatableAttributeMapping(
        ({ currentValue, captures }) =>
          `coverage/${currentValue._id ?? captures.coverageIndex}`,
        {
          info: ({ currentValue }) => currentValue,
          value: ({ currentValue, captures }) =>
            `coverage/${currentValue._id ?? captures.coverageIndex}`,
        },
      ),
    },
  },
  targetPopulations: {
    children: {
      '{targetPopulationIndex}': {
        children: {
          '{language}': translatableAttributeMapping(
            'targetPopulation/{targetPopulationIndex}',
            {
              language: ctx => ctx.captures.language,
            },
          ),
          objectId: {},
        },
      },
    },
  },
  eligibilityMinAge: attributeMapping('numberAttributes', 'eligibilityMinAge', {
    value: ctx => ctx.currentValue,
  }),
  eligibilityMaxAge: attributeMapping('numberAttributes', 'eligibilityMaxAge', {
    value: ctx => ctx.currentValue,
  }),
  phoneNumbers: {
    children: {
      '{phoneNumberIndex}': attributeMapping(
        'stringAttributes',
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
      name: attributeMapping('stringAttributes', 'mainContact/name'),
      email: attributeMapping('stringAttributes', 'mainContact/email'),
      title: {
        children: {
          '{language}': translatableAttributeMapping('mainContact/title', {
            language: context => context.captures.language,
          }),
        },
      },
      phone: attributeMapping('stringAttributes', 'mainContact/phone'),
      isPrivate: attributeMapping('booleanAttributes', 'mainContact/isPrivate'),
    },
  },
  documentsRequired: {
    children: {
      '{documentIndex}': {
        children: {
          objectId: { children: {} },
          '{language}': translatableAttributeMapping(
            ctx =>
              `documentsRequired/${
                ctx.parentValue.objectId ?? ctx.captures.documentIndex
              }`,
            {
              value: ctx => ctx.parentValue[ctx.captures.language],
              language: ctx => ctx.captures.language,
            },
          ),
        },
      },
    },
  },
  paymentMethod: attributeMapping('stringAttributes', 'paymentMethod'),
  operations: {
    children: {
      '{operationSetIndex}': {
        children: {
          '{dayIndex}': {
            children: {
              '{language}': translatableAttributeMapping(
                'operations/{operationSetIndex}/{dayIndex}',
                {
                  value: context => context.currentValue.day,
                  info: context => context.currentValue,
                  language: context => context.captures.language,
                },
              ),
              _id: { children: {} },
            },
          },
          siteId: translatableAttributeMapping('operations/{operationSetIndex}/siteId'),
          _id: { children: {} },
        },
      },
    },
  },
  languages: {
    children: {
      '{languageIndex}': translatableAttributeMapping(
        context =>
          `languages/${context.currentValue._id ?? context.captures.languageIndex}`,
        {
          value: context => context.currentValue.code,
          info: context => context.currentValue,
        },
      ),
    },
  },
  interpretationTranslationServicesAvailable: attributeMapping(
    'booleanAttributes',
    'interpretationTranslationServicesAvailable',
  ),
  available247: attributeMapping('booleanAttributes', 'available247'),
  feeStructureSource: {
    children: {
      '{feeStructureSourceIndex}': {
        children: {
          objectId: { children: {} },
          '{language}': referenceAttributeMapping(
            'feeStructure/{feeStructureSourceIndex}',
            'khp-fee-structure-source',
            {
              value: ctx => ctx.parentValue.en,
              language: ctx => ctx.captures.language,
              // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
            },
          ),
        },
      },
    },
  },

  howIsServiceOffered: {
    children: {
      '{howIsServiceOfferedIndex}': {
        children: {
          '{language}': referenceAttributeMapping(
            'howIsServiceOffered/{howIsServiceOfferedIndex}',
            'khp-how-is-service-offered',
            {
              value: ctx => ctx.parentValue.en,
              language: ctx => ctx.captures.language,
              // value: ctx => ctx.currentValue.en || ctx.currentValue.fr,
            },
          ),
        },
      },
    },
  },
  accessibility: {
    children: {
      objectId: { children: {} },
      '{language}': translatableAttributeMapping('accessibility', {
        language: ctx => ctx.captures.language,
      }),
    },
  },
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
