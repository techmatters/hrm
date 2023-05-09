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

module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert(
      'AgeBrackets',
      [
        {
          bracket: '0-3',
          min: 0,
          max: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '4-6',
          min: 4,
          max: 6,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '7-9',
          min: 7,
          max: 9,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '10-12',
          min: 10,
          max: 12,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '13-15',
          min: 13,
          max: 15,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '16-17',
          min: 16,
          max: 17,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '18-25',
          min: 18,
          max: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '>25',
          min: 26,
          max: 120,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: 'Unknown',
          min: null,
          max: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {},
    ),

  down: queryInterface => queryInterface.bulkDelete('AgeBrackets', null, {}),
};
