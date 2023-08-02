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
  up: async queryInterface => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS resources."Globals"`);
    console.log('Table "Globals" dropped');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS resources."Globals"
      (
         -- This table is used to store global variables (i.e. not scoped to the account)
         -- Having a boolean primary key with a CHECK constraint ensures that only one row is ever created
        "singleRowId" bool NOT NULL PRIMARY KEY DEFAULT true,
        "lastIndexedUpdateSequence"  bigint NOT NULL DEFAULT 0,
        CONSTRAINT "singleRow" CHECK("singleRowId" = true)
      )
    `);
    console.log('Table "Globals" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."Globals"
          OWNER to resources;
    `);
    console.log('Table "Globals" now owned by resources');
  },
};
