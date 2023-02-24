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
      CREATE TABLE IF NOT EXISTS resources."ResourceStringAttributes"
      (
        "resourceId" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "key" text COLLATE pg_catalog."default" NOT NULL,
        "value" text COLLATE pg_catalog."default" NOT NULL,
        "language" text COLLATE pg_catalog."default" NOT NULL,
        "info" JSONB,
        "lastUpdated" timestamp with time zone,
        "updateSequence"  bigint NOT NULL DEFAULT nextval('"Resources_updates_seq"'::regclass),
        CONSTRAINT "ResourceStringAttributes_pkey" PRIMARY KEY ("resourceId", "accountSid", "key", "language", "value")
      )
    `);
    console.log('Table "ResourceStringAttributes" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceStringAttributes"
          OWNER to resources;
    `);
    console.log('Table "ResourceStringAttributes" now owned by resources');

    await queryInterface.sequelize.query(`
      CREATE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        NOT LEAKPROOF
      AS $BODY$
      BEGIN
        IF TG_WHEN <> 'BEFORE' THEN
          RAISE EXCEPTION 'ResourcesLookupTables_updateSequence_trigger() may only run as an BEFORE trigger';
        END IF;

        IF (TG_LEVEL <> 'ROW' OR (TG_OP <> 'UPDATE')) THEN
          RAISE EXCEPTION 'ResourcesLookupTables_updateSequence_trigger() added as trigger for unhandled case: %, %',TG_OP, TG_LEVEL;
          RETURN NULL;
        END IF;
        
        NEW."updateSequence" = nextval('"Resources_updates_seq"'::regclass);
        RETURN NEW;
      END
      $BODY$;
    `);
    console.log('Function "ResourcesLookupTables_updateSequence_trigger" created.');

    await queryInterface.sequelize.query(
      `ALTER FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"() OWNER TO resources`,
    );
    console.log('Function "ResourcesLookupTables_updateSequence_trigger" ownership altered.');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceStringAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceStringAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger Resources_update_trigger created');

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
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS resources."Globals"`);
    console.log('Table "Globals" dropped');
    await queryInterface.sequelize.query(
      `DROP FUNCTION IF EXISTS resources."ResourceStringAttributes_update_trigger"`,
    );
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS resources."ResourceStringAttributes"`,
    );
    console.log('Table "ResourceStringAttributes" dropped');
  },
};
