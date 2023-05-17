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
      'Subcategories',
      [
        {
          // categoryId: 1, // NOTE: NOT ROBUST
          subcategory: 'Emotional abuse',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 1, // NOTE: NOT ROBUST
          subcategory: 'Gang violence',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 2, // NOTE: NOT ROBUST
          subcategory: 'Emotional Bullying',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 2, // NOTE: NOT ROBUST
          subcategory: 'Physical Bullying',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 3, // NOTE: NOT ROBUST
          subcategory: 'Alcohol addiction',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 3, // NOTE: NOT ROBUST
          subcategory: 'Alcohol experimentation',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 4, // NOTE: NOT ROBUST
          subcategory: 'Access to HIV/AIDS Medication and Healthcare',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 4, // NOTE: NOT ROBUST
          subcategory: 'Child living with HIV/AIDS',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {},
    ),

  down: queryInterface => queryInterface.bulkDelete('Subcategories', null, {}),
};
