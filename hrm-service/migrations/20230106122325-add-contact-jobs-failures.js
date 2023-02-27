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
    CREATE SEQUENCE IF NOT EXISTS public."ContactJobsFailures_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1
  `);
    console.log('Created sequence "ContactJobsFailures_id_seq"');

    await queryInterface.sequelize.query(`
    ALTER SEQUENCE public."ContactJobsFailures_id_seq"
        OWNER TO hrm;
  `);
    console.log('Sequence "ContactJobsFailures_id_seq" now owned by HRM');

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ContactJobsFailures"
      (
        id bigint NOT NULL DEFAULT nextval('"ContactJobsFailures_id_seq"'::regclass),
        "contactJobId" integer NOT NULL,
        "attemptNumber" integer NOT NULL,
        "payload" jsonb,
        "createdAt" timestamp with time zone NOT NULL,
        CONSTRAINT "ContactJobsFailures_pkey" PRIMARY KEY (id),
        CONSTRAINT "FK_ContactJobsFailures_ContactJobs" FOREIGN KEY ("contactJobId")
            REFERENCES public."ContactJobs" (id) MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
      )
    `);
    console.log('Table "ContactJobsFailures" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobsFailures"
        OWNER to hrm;
    `);
    console.log('Table "ContactJobsFailures" now owned by HRM');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobs"
          DROP COLUMN IF EXISTS "failedAttemptsPayloads";
    `);
    console.log('Table "ContactJobs.failedAttemptsPayloads" dropped');

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "ContactJobs_poll_due_idx" ON public."ContactJobs"
        USING btree ("completed", "numberOfAttempts", "lastAttempt", "contactId", "accountSid");
    `);
    console.log('Index ContactJobs_poll_due_idx created');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "ContactJobs_poll_due_idx";`);

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobs"
          ADD COLUMN IF NOT EXISTS "failedAttemptsPayloads" jsonb;
    `);

    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS public."ContactJobsFailures"`);

    await queryInterface.sequelize.query(`DROP SEQUENCE public."ContactJobsFailures_id_seq"`);
  },
};
