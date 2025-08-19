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
      -- Oldest contact per case
      WITH oldest_contact_per_case AS (SELECT DISTINCT ON (c."caseId")
          c."caseId",
          c."rawJson"
        FROM "Contacts" c
        ORDER BY c."caseId", c."createdAt" ASC
      )

      UPDATE "Cases" c 
      SET "label" = nullif(trim(concat_ws(' ', ocpc."rawJson"->'childInformation'->>'firstName', ocpc."rawJson"->'childInformation'->>'lastName')), '')
      FROM oldest_contact_per_case ocpc
      WHERE c.id = ocpc."caseId";
    `);
    console.log('"label" column populated in table "Cases"');
  },
  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      UPDATE "Cases"
      SET "label" = NULL;
    `);
    console.log('"label" column set to NULL in table "Cases"');
  },
};
