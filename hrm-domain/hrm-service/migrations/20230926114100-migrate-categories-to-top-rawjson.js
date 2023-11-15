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
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      UPDATE "Contacts" cupdate SET "rawJson" = COALESCE(c."rawJson", '{}'::JSONB) 
        || (jsonb_build_object('caseInformation', (c."rawJson"->'caseInformation')::JSONB - 'categories'))
        || jsonb_build_object('categories', COALESCE(c."rawJson"->'categories', "contactCategoryMaps"."categoryMap", '{}'::JSONB))
        FROM "Contacts" AS c
        LEFT JOIN
        (
          -- Convert the full expansion to the 
          -- Probably a less verbose way to do this, but it is a one off migration, so meh.
          SELECT
          id AS "contactId", jsonb_object_agg(category, subcategories) AS "categoryMap"
          FROM (
            SELECT
            id, category, jsonb_agg(subcategory) as subcategories
            FROM
            (
              SELECT
              id,
              category,
              (subcategoryRecord).key AS subcategory,
              (subcategoryRecord).value as selected
              FROM
              (
                SELECT
                id,
                (category).key AS category,
                jsonb_each((category).value) AS subcategoryRecord
                FROM
                (
                  SELECT 
                  id,
                  jsonb_each("rawJson"->'caseInformation'->'categories') as category
                  FROM "Contacts"
                ) AS expansion1
              ) AS expansion2 
              WHERE (subcategoryRecord).value::text = 'true'
            )
            AS expansion3
            GROUP BY id, category
          )
          AS recompact
          GROUP BY id
        ) AS "contactCategoryMaps" ON c.id = "contactCategoryMaps"."contactId"
        WHERE c.id = cupdate.id AND c."accountSid" = cupdate."accountSid"
    `);
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      UPDATE "Contacts" SET "rawJson" = (COALESCE("rawJson", '{}'::JSONB) 
      -- Case Information and / or category patch
      || (jsonb_build_object('caseInformation', "rawJson"->'caseInformation') || jsonb_build_object('categories', "rawJson"->'categories'))
    ) - 'categories'`);
  },
};
