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

import { ReferrableResource } from '@tech-matters/types';

export const resourceDocuments: ReferrableResource[] = [
  {
    name: 'Employment Assistance Agency',
    id: 'employment-toronto',
    attributes: {
      title: [
        { value: 'This is the english title', language: 'en', info: 'info about the title' },
        { value: 'This is the french title', language: 'fr' },
      ],
      description: [
        {
          value: 'Employment Assistance description',
          language: 'en',
        },
        {
          value: `Description de l'aide à l'emploi`,
          language: 'fr',
        },
      ],
      eligibilityMinAge: [{ value: 10 }],
      eligibilityMaxAge: [{ value: 20 }],
      feeStructure: [{ value: 'free' }],
      keywords: [{ value: 'keyword1' }, { value: 'keyword2' }],
      province: [{ value: 'ON' }],
      city: [{ value: 'Toronto' }],
    },
  },

  {
    name: 'Child/Youth/Family Counselling at counselling Family Services',
    id: 'counselling-london',
    attributes: {
      title: [
        { value: 'This is the english title', language: 'en', info: 'info about the title' },
        { value: 'This is the french title', language: 'fr' },
      ],
      description: [
        {
          value: 'Child/Youth/Family Counselling Services description',
          language: 'en',
        },
        {
          value: `Counseling pour enfants/jeunes/familles Services description`,
          language: 'fr',
        },
      ],
      eligibilityMinAge: [{ value: 3 }],
      eligibilityMaxAge: [{ value: 5 }],
      feeStructure: [{ value: 'free' }],
      keywords: [{ value: 'keyword1' }, { value: 'keyword2' }, { value: 'keyword3' }],
      province: [{ value: 'ON' }],
      city: [{ value: 'London' }],
    },
  },

  {
    name: 'Child/Youth at counselling Family Services',
    id: 'counselling-toronto',
    attributes: {
      title: [
        { value: 'This is the english title', language: 'en', info: 'info about the title' },
        { value: 'This is the french title', language: 'fr' },
      ],
      description: [
        {
          value: 'Child/Youth Counselling at counselling Family Services description',
          language: 'en',
        },
        {
          value: `Counseling pour enfants/jeunes à counselling Family Services description`,
          language: 'fr',
        },
      ],
      eligibilityMinAge: [{ value: 3 }],
      eligibilityMaxAge: [{ value: 5 }],
      feeStructure: [{ value: 'free' }],
      keywords: [{ value: 'keyword1' }, { value: 'keyword2' }, { value: 'keyword3' }],
      province: [{ value: 'ON' }],
      city: [{ value: 'Toronto' }],
    },
  },
];
