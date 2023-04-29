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
    await queryInterface.sequelize.query(`
    CREATE SEQUENCE IF NOT EXISTS public."ContactJobs_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1
  `);
    console.log('Created sequence "ContactJobs_id_seq"');

    await queryInterface.sequelize.query(`
    ALTER SEQUENCE public."ContactJobs_id_seq"
        OWNER TO hrm;
  `);
    console.log('Sequence "ContactJobs_id_seq" now owned by HRM');

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ContactJobs"
      (
        id bigint NOT NULL DEFAULT nextval('"ContactJobs_id_seq"'::regclass),
        "contactId" integer NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "jobType" text COLLATE pg_catalog."default" NOT NULL,
        requested timestamp with time zone NOT NULL,
        completed timestamp with time zone,
        "lastAttempt" timestamp with time zone,
        "numberOfAttempts" integer NOT NULL DEFAULT 0,
        "failedAttemptsPayloads" jsonb,
        "additionalPayload" jsonb,
        "completionPayload" jsonb,
        CONSTRAINT "ContactJobs_pkey" PRIMARY KEY (id),
        CONSTRAINT "FK_ContactJobs_Contacts" FOREIGN KEY ("contactId", "accountSid")
            REFERENCES public."Contacts" (id, "accountSid") MATCH SIMPLE
            ON UPDATE NO ACTION
            ON DELETE NO ACTION
      )
    `);
    console.log('Table "ContactJobs" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobs"
          OWNER to hrm;
    `);
    console.log('Table "ContactJobs" now owned by HRM');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS public."ContactJobs"`);
    console.log('Table "ContactJobs" dropped');

    await queryInterface.sequelize.query(`DROP SEQUENCE public."ContactJobs_id_seq"`);
    console.log('Sequence "ContactJobs_id_seq" dropped');
  },
};
