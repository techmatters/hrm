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
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "public"."Referrals"
      (
        "accountSid" text NOT NULL,
        "contactId" integer NOT NULL,
        "resourceId" text NOT NULL,
        "referredAt" timestamp with time zone NOT NULL,
        "resourceName" text NULL,
        "additionalResourceInfo" jsonb NULL,
        CONSTRAINT "Referrals_pkey" PRIMARY KEY ("contactId", "accountSid", "resourceId", "referredAt"),
        CONSTRAINT "FK_Referrals_Contacts" FOREIGN KEY ("accountSid", "contactId")
            REFERENCES public."Contacts" ("accountSid", id) MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
      )
    `);
    console.log('Table "Referrals" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."Referrals"
        OWNER to hrm;
    `);
    console.log('Table "Referrals" now owned by HRM');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS public."Referrals"`);
  },
};
