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
      UPDATE "Contacts" SET "definitionVersion" = 'as-v1' WHERE "definitionVersion" = 'demo-v1';
      UPDATE "Contacts" SET "definitionVersion" = 'zm-v1' WHERE "definitionVersion" = 'v1';
    `);
    console.log('"definitionVersion" column sanitized in table "Contacts"');

    await queryInterface.sequelize.query(`
      ALTER TABLE "Cases" ADD COLUMN IF NOT EXISTS "definitionVersion" TEXT;
    `);
    console.log('"definitionVersion" column added to table "Cases"');

    await queryInterface.sequelize.query(`
      -- Oldest contact per case
      WITH oldest_contact_per_case AS (SELECT DISTINCT ON (c."caseId")
          c."caseId",
          c."definitionVersion"
        FROM "Contacts" c
        ORDER BY c."caseId", c."createdAt" ASC
      ),

      -- Latest contact per account (for orphan fallback)
      latest_contact_per_account AS (
        SELECT DISTINCT ON (c."accountSid")
          c."accountSid",
          c."definitionVersion"
        FROM "Contacts" c
        ORDER BY c."accountSid", c."createdAt" DESC
      )

      UPDATE "Cases"
      SET "definitionVersion" = COALESCE(c."info"->>'definitionVersion', COALESCE(ocpc."definitionVersion", lcpa."definitionVersion"))
      FROM "Cases" c
      LEFT JOIN oldest_contact_per_case ocpc ON c.id = ocpc."caseId"
      LEFT JOIN latest_contact_per_account lcpa ON c."accountSid" = lcpa."accountSid"
      WHERE "Cases".id = c.id;
    `);
    console.log('"definitionVersion" column populated in table "Cases"');

    await queryInterface.sequelize.query(`
      UPDATE "Cases" SET "definitionVersion" = 'as-v1' WHERE "definitionVersion" = 'demo-v1';
      UPDATE "Cases" SET "definitionVersion" = 'zm-v1' WHERE "definitionVersion" = 'v1';
    `);
    console.log('"definitionVersion" column sanitized in table "Cases"');

    await queryInterface.sequelize.query(`
      ALTER TABLE "Profiles" ADD COLUMN IF NOT EXISTS "definitionVersion" TEXT;
    `);
    console.log('"definitionVersion" column added to table "Profiles"');

    await queryInterface.sequelize.query(`
      WITH
      -- Oldest contact per profile
      oldest_contact_per_profile AS (
        SELECT DISTINCT ON (c."profileId")
          c."profileId",
          c."definitionVersion"
        FROM "Contacts" c
        ORDER BY c."profileId", c."createdAt" ASC
      ),

      -- Latest contact per account (for orphan fallback)
      latest_contact_per_account AS (
        SELECT DISTINCT ON (c."accountSid")
          c."accountSid",
          c."definitionVersion"
        FROM "Contacts" c
        ORDER BY c."accountSid", c."createdAt" DESC
      )

      UPDATE "Profiles"
      SET "definitionVersion" = COALESCE(ocpp."definitionVersion", lcpa."definitionVersion")
      FROM "Profiles" p
      LEFT JOIN oldest_contact_per_profile ocpp ON p.id = ocpp."profileId"
      LEFT JOIN latest_contact_per_account lcpa ON p."accountSid" = lcpa."accountSid"
      WHERE "Profiles".id = p.id;
    `);
    console.log('"definitionVersion" column populated in table "Profiles"');

    await queryInterface.sequelize.query(`
      ALTER TABLE public."Contacts" ALTER COLUMN "definitionVersion" SET NOT NULL;    
    `);
    console.log('"definitionVersion" column for "Contacts" table set to not null');

    await queryInterface.sequelize.query(`
      ALTER TABLE public."Cases" ALTER COLUMN "definitionVersion" SET NOT NULL;    
    `);
    console.log('"definitionVersion" column for "Cases" table set to not null');

    await queryInterface.sequelize.query(`
      ALTER TABLE public."Profiles" ALTER COLUMN "definitionVersion" SET NOT NULL;    
    `);
    console.log('"definitionVersion" column for "Profiles" table set to not null');
  },
  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Profiles" 
      DROP COLUMN IF EXISTS "definitionVersion";
    `);
    console.log('"definitionVersion" column dropped from table "Profiles"');

    await queryInterface.sequelize.query(`
      ALTER TABLE public."Cases" 
      DROP COLUMN IF EXISTS "definitionVersion";
    `);
    console.log('"definitionVersion" column dropped from table "Cases"');
  },
};
