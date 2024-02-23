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

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."Profiles"
      ADD COLUMN "createdBy" text COLLATE pg_catalog."default",
      ADD COLUMN "updatedBy" text COLLATE pg_catalog."default";
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Profiles" SET "createdBy" = 'system';
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Profiles"
      ALTER COLUMN "createdBy" SET NOT NULL;    
    `);
    console.log(
      '"createdBy" & "updatedBy" columns added to table "Profiles", populated with default value "system"',
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."Identifiers"
      ADD COLUMN "createdBy" text COLLATE pg_catalog."default",
      ADD COLUMN "updatedBy" text COLLATE pg_catalog."default";
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Identifiers" SET "createdBy" = 'system';
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Identifiers"
      ALTER COLUMN "createdBy" SET NOT NULL;    
    `);
    console.log(
      '"createdBy" & "updatedBy" columns added to table "Identifiers", populated with default value "system"',
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ProfileFlags"
      ADD COLUMN "createdBy" text COLLATE pg_catalog."default",
      ADD COLUMN "updatedBy" text COLLATE pg_catalog."default";
    `);
    await queryInterface.sequelize.query(`
      UPDATE "ProfileFlags" SET "createdBy" = 'system';
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE public."ProfileFlags"
      ALTER COLUMN "createdBy" SET NOT NULL;    
    `);
    console.log(
      '"createdBy" & "updatedBy" columns added to table "ProfileFlags", populated with default value "system"',
    );
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public."ProfileFlags"
      DROP COLUMN "createdBy",
      DROP COLUMN "updatedBy";
    `);
    console.log('"createdBy" & "updatedBy" columns dropped from table "ProfileFlags"');

    await queryInterface.sequelize.query(`
      ALTER TABLE public."Identifiers"
      DROP COLUMN "createdBy",
      DROP COLUMN "updatedBy";
    `);
    console.log('"createdBy" & "updatedBy" columns dropped from table "Identifiers"');

    await queryInterface.sequelize.query(`
    ALTER TABLE public."Profiles"
    DROP COLUMN "createdBy",
    DROP COLUMN "updatedBy";
  `);
    console.log('"createdBy" & "updatedBy" columns dropped from table "Profiles"');
  },
};
