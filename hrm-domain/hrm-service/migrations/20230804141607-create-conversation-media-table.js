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
      CREATE SEQUENCE IF NOT EXISTS public."ConversationMedias_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1;
    `);
    console.log('Sequence "ConversationMedias_id_seq" created');

    await queryInterface.sequelize.query(`
      ALTER SEQUENCE public."ConversationMedias_id_seq" OWNER TO hrm
    `);
    console.log("Sequence 'ConversationMedias_id_seq' ownership altered.");

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ConversationMedias"
      (
        "contactId" integer,
        id integer NOT NULL DEFAULT nextval('"ConversationMedias_id_seq"'::regclass),
        "storeType" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" character varying(255) COLLATE pg_catalog."default",
        "storeTypeSpecificData" jsonb,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "ConversationMedias_pkey" PRIMARY KEY ("contactId", "id"),
        CONSTRAINT "ConversationMedias_contactId_Contact_id_fk" FOREIGN KEY ("contactId", "accountSid")
            REFERENCES public."Contacts" (id, "accountSid") MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
      )
    `);
    console.log("Table 'ConversationMedias' created.");

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ConversationMedias" OWNER to hrm;
    `);
    console.log("Table 'ConversationMedias' ownership altered.");

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "fki_ConversationMedias_contactId_accountSid_Contact_id_accountSid_fk" ON public."ConversationMedias" USING btree
        ("contactId" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
      `);
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP INDEX public."fki_ConversationMedias_contactId_accountSid_Contact_id_accountSid_fk"`,
    );
    await queryInterface.sequelize.query(`DROP TABLE public."ConversationMedias"`);
    await queryInterface.sequelize.query(`DROP SEQUENCE public."ConversationMedias_id_seq"`);
  },
};
