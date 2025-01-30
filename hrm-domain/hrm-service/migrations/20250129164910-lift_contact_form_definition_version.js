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
      ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "definitionVersion" TEXT;
    `);
    console.log('"definitionVersion" column added to table "Contacts"');

    await queryInterface.sequelize.query(`
      UPDATE "Contacts" SET "definitionVersion" = "rawJson"->>'definitionVersion';
    `);
    console.log('"definitionVersion" column populated in table "Contacts"');
  },
  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Contacts" 
      DROP COLUMN IF EXISTS "definitionVersion";
    `);
    console.log('"definitionVersion" column dropped from table "Contacts"');
  },
};
