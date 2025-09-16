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

import type { FlatResource } from '@tech-matters/resources-types';
import { getResourceIndexConfiguration, RESOURCE_INDEX_TYPE } from '../../index';

const BASELINE_DATE = new Date('2021-01-01T00:00:00.000Z');

describe('convertIndexDocument', () => {
  it('[CA mapping] should convert a simple document', () => {
    const accountShortCode = 'CA';

    // TODO: need a real example of a document to test against because I still have no idea what these are supposed to look like
    const resource: FlatResource = {
      accountSid: 'AC_FAKE',
      name: 'Resource',
      id: '1234',
      lastUpdated: BASELINE_DATE.toISOString(),
      stringAttributes: [
        {
          key: 'title',
          value: 'This is the english title',
          language: 'en',
          info: 'info about the title',
        },
        { key: 'title', value: 'This is the french title', language: 'fr' },
        { key: 'description', value: 'This is the description', language: '' },
        { key: 'keywords', value: 'keyword1', language: '' },
        { key: 'keywords', value: 'keyword2', language: '' },
        { key: 'taxonomies/taxonomy1', value: 'taxonomy1', language: '' },
      ],
      numberAttributes: [
        { key: 'eligibilityMinAge', value: 10 },
        { key: 'eligibilityMaxAge', value: 20 },
      ],
      booleanAttributes: [],
      dateTimeAttributes: [],
      referenceStringAttributes: [
        { key: 'feeStructure', list: 'feeStructures', value: 'free', language: '' },
        { key: 'province', list: 'provinces', value: 'ON', language: '' },
        { key: 'city', list: 'cities', value: 'Toronto', language: '' },
      ],
    };

    const resourceIndexConfiguration = getResourceIndexConfiguration(accountShortCode);

    const document = resourceIndexConfiguration.convertToIndexDocument(
      resource,
      RESOURCE_INDEX_TYPE,
    );

    expect(document).toEqual({
      id: '1234',
      name: ['Resource'],
      high_boost_global: 'This is the description taxonomy1 free',
      low_boost_global:
        'This is the english title This is the french title keyword1 keyword2',
      eligibilityMinAge: 10,
      eligibilityMaxAge: 20,
      city: ['Toronto'],
      feeStructure: 'free',
      province: ['ON'],
      taxonomyLevelName: ['taxonomy1'],
      taxonomyLevelNameCompletion: ['taxonomy1'],
    });
  });

  it('[USCH mapping] should convert a simple document', () => {
    const accountShortCode = 'USCH';

    const resource: FlatResource = {
      accountSid: 'AC_FAKE',
      name: 'Resource',
      id: '1234',
      lastUpdated: BASELINE_DATE.toISOString(),
      stringAttributes: [
        {
          key: 'address/street',
          value: 'street',
          info: null,
          language: '',
        },
        {
          key: 'address/city',
          value: 'city',
          info: null,
          language: '',
        },
        {
          key: 'address/province',
          value: 'province',
          info: null,
          language: '',
        },
        {
          key: 'address/postalCode',
          value: '1234',
          info: null,
          language: '',
        },
        {
          key: 'address/country',
          value: 'country',
          info: null,
          language: '',
        },
        {
          key: 'phoneFax',
          value: '111-222-3333',
          info: null,
          language: '',
        },
        {
          key: 'phone/Hotline/number',
          value: '111-222-3333',
          info: null,
          language: '',
        },
        {
          key: 'phone/Hotline/description',
          value: 'Hotline-description',
          info: null,
          language: 'en',
        },
        {
          key: 'phone/Business/number',
          value: '111-222-3333',
          info: null,
          language: '',
        },
        {
          key: 'websiteAddress',
          value: 'https://websiteAddress',
          info: null,
          language: 'en',
        },
        {
          key: 'description',
          value: 'description',
          info: null,
          language: 'en',
        },
        {
          key: 'enteredOn',
          value: '1/10/2025',
          info: null,
          language: '',
        },
        {
          key: 'shortDescription',
          value: 'short-description',
          info: null,
          language: 'en',
        },
        {
          key: 'lastVerified/on',
          value: '1/10/2025',
          info: null,
          language: '',
        },
        {
          key: 'lastVerified/name',
          value: 'name',
          info: null,
          language: '',
        },
        {
          key: 'lastVerified/title',
          value: 'title',
          info: null,
          language: '',
        },
        {
          key: 'lastVerified/phoneNumber',
          value: '1112223333',
          info: null,
          language: '',
        },
        {
          key: 'lastVerified/emailAddress',
          value: 'emailAddress@example.org',
          info: null,
          language: '',
        },
        {
          key: 'lastVerified/verificationApprovedBy',
          value: 'approver',
          info: null,
          language: '',
        },
        {
          key: 'categories/0',
          value: 'CF - Counseling for Athletes',
          info: null,
          language: 'en',
        },
        {
          key: 'categories/1',
          value: 'CF - Eating Disorders\nCF - Helplines\nCF - Medical Resources/CTE',
          info: null,
          language: 'en',
        },
        {
          key: 'coverage/0',
          value: 'CO - Some County - State',
          info: null,
          language: 'en',
        },
        {
          key: 'feeStructure',
          value: 'Free',
          info: null,
          language: 'en',
        },
      ],
      numberAttributes: [],
      booleanAttributes: [],
      dateTimeAttributes: [],
      referenceStringAttributes: [],
    };

    const resourceIndexConfiguration = getResourceIndexConfiguration(accountShortCode);

    const document = resourceIndexConfiguration.convertToIndexDocument(
      resource,
      RESOURCE_INDEX_TYPE,
    );

    console.log(JSON.stringify(document, null, 2));

    expect(document).toEqual({
      id: '1234',
      name: 'Resource',
      high_boost_global: 'street 1234 description Free',
      low_boost_global:
        '111-222-3333 111-222-3333 Hotline-description 111-222-3333 https://websiteAddress 1/10/2025 short-description 1/10/2025 name title 1112223333 emailAddress@example.org approver CO - Some County - State',
      categoriesName: [
        'CF - Counseling for Athletes',
        'CF - Eating Disorders\nCF - Helplines\nCF - Medical Resources/CTE',
      ],
      categoriesNameCompletion: [
        'CF - Counseling for Athletes',
        'CF - Eating Disorders\nCF - Helplines\nCF - Medical Resources/CTE',
      ],
      country: ['country'],
      province: ['province'],
      city: ['city'],
      feeStructure: 'Free',
    });
  });
});
