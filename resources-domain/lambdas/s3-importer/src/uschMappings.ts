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
  MappingNode,
  resourceFieldMapping,
  attributeMapping,
  transformExternalResourceToApiResource,
  translatableAttributeMapping,
} from '@tech-matters/resources-mappers';
import type { AccountSID } from '@tech-matters/types';
import type { FlatResource } from '@tech-matters/resources-types';
import { parse } from 'date-fns';

// https://gist.github.com/mshafrir/2646763
const US_STATE_CODE_MAPPING = {
  AL: 'Alabama',
  AK: 'Alaska',
  AS: 'American Samoa',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District Of Columbia',
  FM: 'Federated States Of Micronesia',
  FL: 'Florida',
  GA: 'Georgia',
  GU: 'Guam',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MH: 'Marshall Islands',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  MP: 'Northern Mariana Islands',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PW: 'Palau',
  PA: 'Pennsylvania',
  PR: 'Puerto Rico',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VI: 'Virgin Islands',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
} as Record<string, string>;

const CANADIAN_PROVINCE_CODE_MAPPING = {
  AB: 'Alberta',
  BC: 'British Columbia',
  NL: 'Newfoundland and Labrador',
  PE: 'Île-du-Prince-Édouard',
  NS: 'Nouvelle-Écosse',
  NB: 'New Brunswick',
  ON: 'Ontario',
  MB: 'Manitoba',
  SK: 'Saskatchewan',
  YT: 'Yukon',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  QC: 'Québec',
} as Record<string, string>;

/*
 * This defines all the mapping logic to convert Childhelp resource to an Aselo resource.
 * The mapping is defined as a tree of nodes.
 * If the content of this node needs to be written to the Aselo DB, it should be provided a "khp mapping" function, depending on where the data should be written.
 * Child nodes are defined within the `children` property. This are processed recursively.
 * If the names of the child nodes are dynamic, e.g. one per language, or one per social media channel, the node should be named with a placeholder token, e.g. '{language}' or '{channel}'. This will make the importer process all child data nodes and capture their property under `captures` property of the context object for use generating keys, values & info etc..
 */

/**
 * Represents the resource as parsed from the Csv
 */
export type UschCsvResource = {
  ResourceID: string;
  Name: string;
  AlternateName: string;
  Address: string;
  City: string;
  StateProvince: string;
  PostalCode: string;
  Country: string;
  HoursOfOperation: string;
  Phone1: string;
  Phone1Name: string;
  Phone1Description: string;
  Phone2: string;
  Phone2Name: string;
  Phone2Description: string;
  Phone3: string;
  Phone3Name: string;
  Phone3Description: string;
  Phone4: string;
  Phone4Name: string;
  Phone4Description: string;
  PhoneFax: string;
  PhoneTTY: string;
  PhoneTTYDescription: string;
  PhoneHotline: string;
  PhoneHotlineDescription: string;
  PhoneBusiness: string;
  PhoneBusinessDescription: string;
  PhoneAfterHours: string;
  PhoneAfterHoursDescription: string;
  EmailAddress: string;
  WebsiteAddress: string;
  Description: string;
  FeeStructure: string;
  OtherLanguages: string;
  EnteredOn: string;
  UpdatedOn: string;
  ShortDescription: string;
  LastVerifiedOn: string;
  LastVerifiedByName: string;
  LastVerifiedByTitle: string;
  LastVerifiedByPhoneNumber: string;
  LastVerifiedByEmailAddress: string;
  LastVerificationApprovedBy: string;
  Categories: string;
  Coverage: string;
  Comment: string;
  HoursFormatted: string;
};

export type UschExpandedResource = Partial<
  Omit<UschCsvResource, 'Categories' | 'Coverage'> & {
    Categories: string[];
    Coverage: string[];
  }
>;

const isUnitedStates = (country: string | undefined) =>
  ['us', 'usa', 'unitedstates'].includes(
    (country ?? '').toLowerCase().replaceAll(/[.\s]/g, ''),
  );

const isUSStateOrTerritory = (country: string | undefined) =>
  country &&
  (Object.keys(US_STATE_CODE_MAPPING).includes(country) ||
    Object.values(US_STATE_CODE_MAPPING).includes(country));

const isCanadianProvince = (country: string | undefined) =>
  country &&
  (Object.keys(CANADIAN_PROVINCE_CODE_MAPPING).includes(country) ||
    Object.values(CANADIAN_PROVINCE_CODE_MAPPING).includes(country));

const lookupUsStateNameFromCode = ({
  Country: country,
  StateProvince: stateProvince,
}: UschExpandedResource): string | undefined => {
  if (isUnitedStates(country)) {
    return US_STATE_CODE_MAPPING[stateProvince ?? ''] ?? stateProvince;
  }
  return stateProvince;
};

export const expandCsvLine = (csv: UschCsvResource): UschExpandedResource => {
  const expanded = {
    ...csv,
    Categories: csv.Categories?.split(';').filter(Boolean),
    Coverage: csv.Coverage?.split(';').filter(Boolean),
  };
  for (const key in expanded) {
    const validKey = key as keyof UschExpandedResource;
    if (expanded[validKey] === undefined || expanded[validKey] === '') {
      delete expanded[validKey];
    }
  }
  return expanded;
};

export const USCH_MAPPING_NODE: MappingNode = {
  ResourceID: resourceFieldMapping('id'),
  Name: resourceFieldMapping('name'),
  AlternateName: translatableAttributeMapping('alternateName', { language: 'en' }),
  Address: attributeMapping('stringAttributes', 'address/street'),
  City: attributeMapping('stringAttributes', 'address/city', {
    value: ({ currentValue, rootResource }) =>
      [
        (rootResource as UschExpandedResource).Country,
        (rootResource as UschExpandedResource).StateProvince,
        currentValue,
      ].join('/'),
    info: ({ currentValue, rootResource }) => ({
      country: (rootResource as UschExpandedResource).Country,
      stateProvince: lookupUsStateNameFromCode(rootResource as UschExpandedResource),
      name: currentValue,
    }),
  }),
  StateProvince: attributeMapping('stringAttributes', 'address/province', {
    value: ({ currentValue, rootResource }) =>
      `${(rootResource as UschExpandedResource).Country}/${currentValue}`,
    info: ({ rootResource }) => ({
      country: (rootResource as UschExpandedResource).Country,
      name: lookupUsStateNameFromCode(rootResource as UschExpandedResource),
    }),
  }),
  PostalCode: attributeMapping('stringAttributes', 'address/postalCode'),
  Country: attributeMapping('stringAttributes', 'address/country'),
  HoursOfOperation: translatableAttributeMapping('hoursOfOperation'),
  ...Object.fromEntries(
    [1, 2, 3, 4].flatMap(phoneIdentifier => [
      [
        `Phone${phoneIdentifier}`,
        translatableAttributeMapping(`phone/${phoneIdentifier}/number`, {
          language: 'en',
        }),
      ],
      [
        `Phone${phoneIdentifier}Name`,
        translatableAttributeMapping(`phone/${phoneIdentifier}/name`, { language: 'en' }),
      ],
      [
        `Phone${phoneIdentifier}Description`,
        translatableAttributeMapping(`phone/${phoneIdentifier}/description`, {
          language: 'en',
        }),
      ],
    ]),
  ),
  PhoneFax: translatableAttributeMapping('phoneFax'),
  ...Object.fromEntries(
    ['TTY', 'Hotline', 'Business', 'AfterHours'].flatMap(phoneIdentifier => [
      [
        `Phone${phoneIdentifier}`,
        translatableAttributeMapping(`phone/${phoneIdentifier}/number`),
      ],
      [
        `Phone${phoneIdentifier}Description`,
        translatableAttributeMapping(`phone/${phoneIdentifier}/description`, {
          language: 'en',
        }),
      ],
    ]),
  ),
  EmailAddress: translatableAttributeMapping('emailAddress', { language: 'en' }),
  WebsiteAddress: translatableAttributeMapping('websiteAddress', { language: 'en' }),
  Description: translatableAttributeMapping('description', { language: 'en' }),
  FeeStructure: translatableAttributeMapping('feeStructure', { language: 'en' }),
  OtherLanguages: attributeMapping('stringAttributes', 'otherLanguages'),
  EnteredOn: attributeMapping('stringAttributes', 'enteredOn'),
  UpdatedOn: resourceFieldMapping('lastUpdated', ({ currentValue }) =>
    parse(currentValue, 'M/d/yyyy', new Date()).toISOString(),
  ),
  ShortDescription: translatableAttributeMapping('shortDescription', { language: 'en' }),
  LastVerifiedOn: attributeMapping('stringAttributes', 'lastVerified/on'),
  LastVerifiedByName: attributeMapping('stringAttributes', 'lastVerified/name'),
  LastVerifiedByTitle: attributeMapping('stringAttributes', 'lastVerified/title'),
  LastVerifiedByPhoneNumber: attributeMapping(
    'stringAttributes',
    'lastVerified/phoneNumber',
  ),
  LastVerifiedByEmailAddress: attributeMapping(
    'stringAttributes',
    'lastVerified/emailAddress',
  ),
  LastVerificationApprovedBy: attributeMapping(
    'stringAttributes',
    'lastVerified/verificationApprovedBy',
  ),
  Categories: {
    children: {
      '{categoryIndex}': translatableAttributeMapping('categories/{categoryIndex}', {
        value: ({ currentValue }) => currentValue,
        language: 'en',
      }),
    },
  },
  Coverage: {
    children: {
      '{coverageIndex}': {
        mappings: [
          translatableAttributeMapping('coverage/{coverageIndex}', {
            value: ({ currentValue }) => {
              const [countryOrState] = currentValue.toString().split(/\s+-\s+/);

              if (isUSStateOrTerritory(countryOrState)) {
                return `United States/${currentValue.replaceAll(/\s+-\s+/g, '/')}`;
              } else {
                return `${currentValue.replaceAll(/\s+-\s+/g, '/')}`;
              }
            },
            info: ({ currentValue }) => {
              const [countryOrState, provinceOrCity, internationalCity] = currentValue
                .toString()
                .split(/\s+-\s+/);
              if (isUSStateOrTerritory(countryOrState)) {
                return {
                  country: 'United States',
                  stateProvince:
                    US_STATE_CODE_MAPPING[countryOrState ?? ''] ?? countryOrState,
                  city: provinceOrCity,
                  name: currentValue,
                };
              } else if (isCanadianProvince(countryOrState)) {
                return {
                  country: 'Canada',
                  stateProvince:
                    CANADIAN_PROVINCE_CODE_MAPPING[countryOrState ?? ''] ??
                    countryOrState,
                  city: provinceOrCity,
                  name: currentValue,
                };
              } else {
                return {
                  country: countryOrState,
                  stateProvince: provinceOrCity,
                  city: internationalCity,
                  name: currentValue,
                };
              }
            },
            language: 'en',
          }),
          // Not using coverage/country because that makes things bessy with root coverage values
          translatableAttributeMapping('coverageCountry/{coverageIndex}', {
            value: ({ currentValue }) => {
              const [countryOrState] = currentValue.toString().split(/\s+-\s+/);
              if (isUSStateOrTerritory(countryOrState)) {
                return 'United States';
              } else if (isCanadianProvince(countryOrState)) {
                return 'Canada';
              } else {
                return countryOrState;
              }
            },
            language: 'en',
          }),
          // Not using coverage/province because that makes things bessy with root coverage values
          translatableAttributeMapping('coverageStateProvince/{coverageIndex}', {
            value: ({ currentValue }) => {
              const [countryOrState, provinceOrCity] = currentValue
                .toString()
                .split(/\s+-\s+/);
              if (isUSStateOrTerritory(countryOrState)) {
                return `United States/${countryOrState}`;
              } else if (isCanadianProvince(countryOrState)) {
                return `Canada/${countryOrState}`;
              } else if (provinceOrCity) {
                return `${countryOrState}/${provinceOrCity}`;
              } else return '';
            },
            info: ({ currentValue }) => {
              const [countryOrState, provinceOrCity] = currentValue
                .toString()
                .split(/\s+-\s+/);
              if (isUSStateOrTerritory(countryOrState)) {
                const stateProvince =
                  US_STATE_CODE_MAPPING[countryOrState ?? ''] ?? countryOrState;
                return {
                  country: 'United States',
                  stateProvince,
                  name: stateProvince,
                };
              } else if (isCanadianProvince(countryOrState)) {
                const stateProvince =
                  CANADIAN_PROVINCE_CODE_MAPPING[countryOrState ?? ''] ?? countryOrState;
                return {
                  country: 'Canada',
                  stateProvince,
                  name: stateProvince,
                };
              } else if (provinceOrCity) {
                return {
                  country: countryOrState,
                  stateProvince: provinceOrCity,
                  name: provinceOrCity,
                };
              } else return null;
            },
            language: 'en',
          }),
          // Not using coverage/city because that makes things messy with root coverage values
          translatableAttributeMapping('coverageCity/{coverageIndex}', {
            value: ({ currentValue }) => {
              const [countryOrState, provinceOrCity, internationalCity] = currentValue
                .toString()
                .split(/\s+-\s+/);
              if (isUSStateOrTerritory(countryOrState)) {
                return `United States/${countryOrState}/${provinceOrCity}`;
              } else if (isCanadianProvince(countryOrState)) {
                return `Canada/${countryOrState}/${provinceOrCity}`;
              } else if (internationalCity) {
                return `${countryOrState}/${provinceOrCity}/${internationalCity}`;
              } else return '';
            },
            info: ({ currentValue, rootResource }) => {
              const [countryOrState, provinceOrCity, internationalCity] = currentValue
                .toString()
                .split(/\s+-\s+/);
              if (isUSStateOrTerritory(countryOrState)) {
                const stateProvince =
                  US_STATE_CODE_MAPPING[countryOrState ?? ''] ?? countryOrState;
                return {
                  country: 'United States',
                  stateProvince,
                  city: provinceOrCity,
                  name: provinceOrCity,
                };
              } else if (isCanadianProvince(rootResource.Country)) {
                const stateProvince =
                  CANADIAN_PROVINCE_CODE_MAPPING[countryOrState ?? ''] ?? countryOrState;
                return {
                  country: 'Canada',
                  stateProvince,
                  city: provinceOrCity,
                  name: provinceOrCity,
                };
              } else if (internationalCity) {
                return {
                  country: countryOrState,
                  stateProvince: provinceOrCity,
                  city: internationalCity,
                  name: internationalCity,
                };
              } else {
                return null;
              }
            },
            language: 'en',
          }),
        ],
      },
    },
  },
  Comment: translatableAttributeMapping('comment', { language: 'en' }),
  HoursFormatted: translatableAttributeMapping('hoursFormatted', { language: 'en' }),
};

export const transformUschResourceToApiResource = (
  accountSid: AccountSID,
  uschResource: UschExpandedResource,
): FlatResource =>
  transformExternalResourceToApiResource(USCH_MAPPING_NODE, accountSid, uschResource);
