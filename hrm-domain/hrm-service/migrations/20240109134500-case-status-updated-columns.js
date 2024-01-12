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
      ALTER TABLE IF EXISTS public."Cases"
      ADD COLUMN "statusUpdatedAt" timestamp with time zone,
      ADD COLUMN "statusUpdatedBy" text COLLATE pg_catalog."default",
      ADD COLUMN "previousStatus" text COLLATE pg_catalog."default";
    `);
    console.log(
      '"statusUpdatedAt", "statusUpdatedBy" & "previousStatus" columns added to table "Cases"',
    );
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Cases" 
      DROP COLUMN IF EXISTS "statusUpdatedAt",
      DROP COLUMN IF EXISTS "statusUpdatedBy",
      DROP COLUMN IF EXISTS "previousStatus";
    `);
    console.log(
      '"statusUpdatedAt", "statusUpdatedBy" & "previousStatus" columns dropped from table "Cases"',
    );
  },
};
