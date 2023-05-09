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
      CREATE TABLE IF NOT EXISTS resources."ResourceBooleanAttributes"
      (
        "resourceId" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "key" text COLLATE pg_catalog."default" NOT NULL,
        "value" bool NOT NULL,
        "info" JSONB,
        "lastUpdated" timestamp with time zone,
        "updateSequence"  bigint NOT NULL DEFAULT nextval('"Resources_updates_seq"'::regclass),
        CONSTRAINT "ResourceBooleanAttributes_pkey" PRIMARY KEY ("resourceId", "accountSid", "key", "value"),
        CONSTRAINT "FK_ResourceBooleanAttributes_Resources" FOREIGN KEY ("resourceId", "accountSid")
            REFERENCES resources."Resources" (id, "accountSid") MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
      )
    `);
    console.log('Table "ResourceBooleanAttributes" created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceBooleanAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceBooleanAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceBooleanAttributes_update_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS resources."ResourceNumberAttributes"
      (
        "resourceId" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "key" text COLLATE pg_catalog."default" NOT NULL,
        -- Using double precision because that matches the JavaScript Number type it will be passed in from
        -- If we need precise decimal values, we should store them as strings
        "value" double precision NOT NULL, 
        "info" JSONB,
        "lastUpdated" timestamp with time zone,
        "updateSequence"  bigint NOT NULL DEFAULT nextval('"Resources_updates_seq"'::regclass),
        CONSTRAINT "ResourceNumberAttributes_pkey" PRIMARY KEY ("resourceId", "accountSid", "key", "value"),
        CONSTRAINT "FK_ResourceNumberAttributes_Resources" FOREIGN KEY ("resourceId", "accountSid")
            REFERENCES resources."Resources" (id, "accountSid") MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
      )
    `);
    console.log('Table "ResourceNumberAttributes" created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceNumberAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceNumberAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceNumberAttributes_update_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS resources."ResourceDateTimeAttributes"
      (
        "resourceId" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "key" text COLLATE pg_catalog."default" NOT NULL,
        "value" text COLLATE pg_catalog."default" NOT NULL,
        "info" JSONB,
        "lastUpdated" timestamp with time zone,
        "updateSequence"  bigint NOT NULL DEFAULT nextval('"Resources_updates_seq"'::regclass),
        CONSTRAINT "ResourceDateTimeAttributes_pkey" PRIMARY KEY ("resourceId", "accountSid", "key", "value"),
        CONSTRAINT "FK_ResourceDateTimeAttributes_Resources" FOREIGN KEY ("resourceId", "accountSid")
            REFERENCES resources."Resources" (id, "accountSid") MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
      )
    `);
    console.log('Table "ResourceDateTimeAttributes" created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceDateTimeAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceDateTimeAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceDateTimeAttributes_update_trigger created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS resources."ResourceDateTimeAttributes"`,
    );
    console.log('Table "ResourceDateTimeAttributes" dropped');
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS resources."ResourceNumberAttributes"`,
    );
    console.log('Table "ResourceNumberAttributes" dropped');
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS resources."ResourceBooleanAttributes"`,
    );
    console.log('Table "ResourceBooleanAttributes" dropped');
  },
};
