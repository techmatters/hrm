import {
  FieldMappingContext,
  khpAttributeMapping,
  KhpMappingNode,
  khpReferenceAttributeMapping,
  khpResourceFieldMapping,
  substitueCaptureTokens,
} from './khp-aselo-converter';

// TODO: Change to site ID when we have it
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

export const KHP_MAPPING_NODE: KhpMappingNode = {
  resourceID: khpResourceFieldMapping('id'),
  agency: {
    children: {
      name: {
        children: {
          '{language}': khpAttributeMapping('ResourceStringAttributes', 'agency/name', {
            language: context => context.captures.language,
          }),
        },
      },
      details: {
        children: {
          '{language}': khpAttributeMapping('ResourceStringAttributes', 'agency/details', {
            value: 'agency/details',
            info: context => context.currentValue,
            language: context => context.captures.language,
          }),
        },
      },
      isLocationPrivate: khpAttributeMapping(
        'ResourceBooleanAttributes',
        'agency/isLocationPrivate',
      ),
      location: {
        children: {
          address1: khpAttributeMapping('ResourceStringAttributes', 'agency/location/address1'),
          address2: khpAttributeMapping('ResourceStringAttributes', 'agency/location/address2'),
          city: khpAttributeMapping('ResourceStringAttributes', 'agency/location/city'),
          county: khpAttributeMapping('ResourceStringAttributes', 'agency/location/county'),
          province: khpReferenceAttributeMapping('agency/location/province', 'canadian-provinces'),
          country: khpReferenceAttributeMapping('agency/location/country', 'khp-countries'),
          postalCode: khpAttributeMapping('ResourceStringAttributes', 'agency/location/postalCode'),
        },
      },
      email: khpAttributeMapping('ResourceStringAttributes', 'agency/email'),
      operations: {
        children: {
          '{dayIndex}': {
            children: {
              '{language}': khpAttributeMapping(
                'ResourceStringAttributes',
                'agency/operations/{dayIndex}',
                {
                  value: context => context.currentValue.day,
                  info: context => context.currentValue,
                },
              ),
            },
          },
        },
      },
      phoneNumbers: {
        children: {
          '{phoneNumberType}': khpAttributeMapping(
            'ResourceStringAttributes',
            'agency/phone/{phoneNumberType}',
          ),
        },
      },
    },
  },
  sites: {
    children: {
      '{siteIndex}': {
        children: {
          name: khpAttributeMapping('ResourceStringAttributes', siteKey('name')),
          details: {
            children: {
              '{language}': khpAttributeMapping('ResourceStringAttributes', siteKey('details'), {
                value: siteKey('details'),
                info: context => context.currentValue,
              }),
            },
          },
          isActive: khpAttributeMapping('ResourceBooleanAttributes', siteKey('isActive')),
          isLocationPrivate: khpAttributeMapping(
            'ResourceBooleanAttributes',
            'agency/isLocationPrivate',
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
                  '{language}': khpAttributeMapping(
                    'ResourceStringAttributes',
                    siteKey('operations/{dayIndex}'),
                    {
                      value: context => context.currentValue.day,
                      info: context => context.currentValue,
                    },
                  ),
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
      '{language}': khpAttributeMapping('ResourceStringAttributes', 'nameDetails', {
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
          '{language}': khpAttributeMapping('ResourceStringAttributes', 'operations/{dayIndex}', {
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
        'phone/{phoneNumberType}',
      ),
    },
  },
  mainContact: {
    children: {
      name: khpAttributeMapping('ResourceStringAttributes', 'mainContact/name'),
      email: khpAttributeMapping('ResourceStringAttributes', 'mainContact/email'),
      title: khpAttributeMapping('ResourceStringAttributes', 'mainContact/title'),
      phoneNumber: khpAttributeMapping('ResourceStringAttributes', 'mainContact/phoneNumber'),
      isPrivate: khpAttributeMapping('ResourceStringAttributes', 'mainContact/isPrivate'),
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
};
