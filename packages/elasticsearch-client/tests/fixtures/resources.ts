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

import { FlatResource } from '@tech-matters/types';
const BASELINE_DATE = new Date('2021-01-01T00:00:00.000Z');

export const resourceDocuments: FlatResource[] = [
  {
    name: 'Employment Assistance Agency',
    id: 'employment-toronto',
    lastUpdated: BASELINE_DATE.toISOString(),
    stringAttributes: [
      {
        key: 'title',
        value: 'This is the english title',
        language: 'en',
        info: 'info about the title',
      },
      { key: 'title', value: 'This is the french title', language: 'fr' },
      { key: 'description', value: 'Employment Assistance description', language: 'en' },
      { key: 'description', value: "Description de l'aide à l'emploi", language: 'fr' },
      { key: 'keywords', value: 'keyword1', language: '' },
      { key: 'keywords', value: 'keyword2', language: '' },
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
  },

  {
    name: 'Child/Youth/Family Counselling at counselling Family Services',
    id: 'counselling-london',
    lastUpdated: BASELINE_DATE.toISOString(),
    stringAttributes: [
      {
        key: 'title',
        value: 'This is the english title',
        language: 'en',
        info: 'info about the title',
      },
      { key: 'title', value: 'This is the french title', language: 'fr' },
      {
        key: 'description',
        value: 'Child/Youth/Family Counselling Services description',
        language: 'en',
      },
      {
        key: 'description',
        value: 'Counseling pour enfants/jeunes/familles Services description',
        language: 'fr',
      },
      { key: 'keywords', value: 'keyword1', language: '' },
      { key: 'keywords', value: 'keyword2', language: '' },
      { key: 'keywords', value: 'keyword3', language: '' },
    ],
    numberAttributes: [
      { key: 'eligibilityMinAge', value: 3 },
      { key: 'eligibilityMaxAge', value: 5 },
    ],
    booleanAttributes: [],
    dateTimeAttributes: [],
    referenceStringAttributes: [
      { key: 'feeStructure', list: 'feeStructures', value: 'free', language: '' },
      { key: 'province', list: 'provinces', value: 'ON', language: '' },
      { key: 'city', list: 'cities', value: 'London', language: '' },
    ],
  },
  {
    name: 'Child/Youth at counselling Family Services',
    id: 'counselling-toronto',
    lastUpdated: BASELINE_DATE.toISOString(),
    stringAttributes: [
      {
        key: 'title',
        value: 'This is the english title',
        language: 'en',
        info: 'info about the title',
      },
      { key: 'title', value: 'This is the french title', language: 'fr' },
      {
        key: 'description',
        value: 'Child/Youth Counselling at counselling Family Services description',
        language: 'en',
      },
      {
        key: 'description',
        value: 'Counseling pour enfants/jeunes à counselling Family Services description',
        language: 'fr',
      },
      { key: 'keywords', value: 'keyword1', language: '' },
      { key: 'keywords', value: 'keyword2', language: '' },
      { key: 'keywords', value: 'keyword3', language: '' },
    ],
    numberAttributes: [
      { key: 'eligibilityMinAge', value: 3 },
      { key: 'eligibilityMaxAge', value: 5 },
    ],
    booleanAttributes: [],
    dateTimeAttributes: [],
    referenceStringAttributes: [
      { key: 'feeStructure', list: 'feeStructures', value: 'free', language: '' },
      { key: 'province', list: 'provinces', value: 'ON', language: '' },
      { key: 'city', list: 'cities', value: 'London', language: '' },
    ],
  },
];
