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
    // This migration could be more concise if we used CASCADE on delete, but I thought it would be safer to be explicit about what we're deleting.
    // This way any unexpected dependencies would be flagged as errors rather than silently deleted.
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceStringAttributes_update_trigger" ON resources."ResourceStringAttributes";
    `);
    console.log(
      'ResourceStringAttributes_update_trigger dropped on table "ResourceStringAttributes"',
    );
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceDateTimeAttributes_update_trigger" ON resources."ResourceDateTimeAttributes";
    `);
    console.log(
      'ResourceDateTimeAttributes_updateSequence_trigger dropped on table "ResourceDateTimeAttributes"',
    );
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceBooleanAttributes_update_trigger" ON resources."ResourceBooleanAttributes";
    `);
    console.log(
      'ResourceBooleanAttributes_update_trigger dropped on table "ResourceBooleanAttributes"',
    );
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceNumberAttributes_update_trigger" ON resources."ResourceNumberAttributes";
    `);
    console.log(
      'ResourceNumberAttributes_update_trigger dropped on table "ResourceNumberAttributes"',
    );
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceBooleanAttributes_update_trigger" ON resources."ResourceBooleanAttributes";
    `);
    console.log(
      'ResourceBooleanAttributes_update_trigger dropped on table "ResourceBooleanAttributes"',
    );
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceReferenceStringAttributes_update_trigger" ON resources."ResourceReferenceStringAttributes";
    `);
    console.log(
      'ResourceReferenceStringAttributes_update_trigger dropped on table "ResourceReferenceStringAttributes"',
    );
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceReferenceStringAttributeValues_update_trigger" ON resources."ResourceReferenceStringAttributeValues";
    `);
    console.log(
      'ResourceReferenceStringAttributeValues_update_trigger dropped on table "ResourceReferenceStringAttributeValues"',
    );

    await queryInterface.sequelize.query(
      `DROP FUNCTION IF EXISTS resources."ResourcesLookupTables_updateSequence_trigger"`,
    );
    console.log('Function "ResourcesLookupTables_updateSequence_trigger" dropped');

    await queryInterface.sequelize.query(
      `ALTER TABLE resources."ResourceStringAttributes" DROP COLUMN IF EXISTS "updateSequence", DROP COLUMN IF EXISTS "lastUpdated"`,
    );
    console.log(
      'Columns "updateSequence", "lastUpdated" dropped from table "ResourceStringAttributes"',
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE resources."ResourceDateTimeAttributes" DROP COLUMN IF EXISTS "updateSequence", DROP COLUMN IF EXISTS "lastUpdated"`,
    );
    console.log(
      'Columns "updateSequence", "lastUpdated" dropped from table "ResourceDateTimeAttributes"',
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE resources."ResourceBooleanAttributes" DROP COLUMN IF EXISTS "updateSequence", DROP COLUMN IF EXISTS "lastUpdated"`,
    );
    console.log(
      'Columns "updateSequence", "lastUpdated" dropped from table "ResourceBooleanAttributes"',
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE resources."ResourceNumberAttributes" DROP COLUMN IF EXISTS "updateSequence", DROP COLUMN IF EXISTS "lastUpdated"`,
    );
    console.log(
      'Columns "updateSequence", "lastUpdated" dropped from table "ResourceNumberAttributes"',
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE resources."ResourceReferenceStringAttributes" DROP COLUMN IF EXISTS "updateSequence"`,
    );
    console.log('Column "updateSequence" dropped from table "ResourceReferenceStringAttributes"');
    await queryInterface.sequelize.query(
      `ALTER TABLE resources."ResourceReferenceStringAttributeValues" DROP COLUMN IF EXISTS "updateSequence", DROP COLUMN IF EXISTS "lastUpdated"`,
    );
    console.log(
      'Columns "updateSequence", "lastUpdated" dropped from table "ResourceReferenceStringAttributeValues"',
    );

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "Resources_update_trigger" ON resources."Resources";
    `);
    console.log('Trigger "Resources_updateSequence_trigger" dropped');

    await queryInterface.sequelize.query(
      `DROP FUNCTION resources."Resources_updateSequence_trigger"`,
    );
    console.log('Function "Resources_updateSequence_trigger" dropped');

    await queryInterface.sequelize.query(
      `ALTER TABLE resources."Resources" DROP COLUMN IF EXISTS "updateSequence"`,
    );
    console.log('Column "updateSequence" dropped from table "Resources"');

    await queryInterface.sequelize.query(
      `DROP SEQUENCE IF EXISTS resources."Resources_updateSequence_seq"`,
    );
    console.log('Sequence "Resources_updateSequence_seq" dropped');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
    CREATE SEQUENCE IF NOT EXISTS resources."Resources_updates_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1
  `);
    console.log('Created sequence "Resources_updates_seq"');
    await queryInterface.sequelize.query(`
    ALTER SEQUENCE resources."Resources_updates_seq"
        OWNER TO resources;
  `);
    console.log('Sequence "Resources_updates_seq" now owned by resources');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."Resources" ADD COLUMN IF NOT EXISTS "updateSequence" bigint DEFAULT nextval('resources."Resources_updates_seq"'::regclass) NOT NULL;
    `);
    console.log('Table "Resources" updateSequence column added');

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION resources."Resources_updateSequence_trigger"()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        NOT LEAKPROOF
      AS $BODY$
      BEGIN
        IF TG_WHEN <> 'AFTER' THEN
          RAISE EXCEPTION 'Resources_updateSequence_trigger() may only run as an AFTER trigger';
        END IF;

        IF (TG_LEVEL <> 'ROW' OR (TG_OP <> 'UPDATE')) THEN
          RAISE EXCEPTION 'Resources_updateSequence_trigger() added as trigger for unhandled case: %, %',TG_OP, TG_LEVEL;
          RETURN NULL;
        END IF;
        
        UPDATE resources."Resources" SET "updateSequence" = nextval('resources."Resources_updates_seq"'::regclass), "lastUpdated" = NOW() WHERE "id" = NEW.id AND "accountSid" = NEW."accountSid";
        RETURN NULL;
      END
      $BODY$;
    `);
    console.log('Function "Resources_updateSequence_trigger" reverted.');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Resources_update_trigger"
      AFTER UPDATE 
      ON resources."Resources"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."Resources_updateSequence_trigger"();
    `);
    console.log('Trigger Resources_update_trigger created');

    await queryInterface.sequelize.query(`CREATE UNIQUE INDEX "Resources_updateSequence_idx"
      ON resources."Resources" USING btree
      ("updateSequence" DESC NULLS LAST)
      TABLESPACE pg_default;`);

    console.log('Index Resources_updateSequence_idx created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceStringAttributes" 
        ADD COLUMN IF NOT EXISTS "updateSequence" bigint DEFAULT nextval('resources."Resources_updates_seq"'::regclass) NOT NULL, 
        ADD COLUMN IF NOT EXISTS "lastUpdated" timestamp with time zone;;
    `);
    console.log('Table "ResourceStringAttributes" updateSequence column added');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceDateTimeAttributes" 
        ADD COLUMN IF NOT EXISTS "updateSequence" bigint DEFAULT nextval('resources."Resources_updates_seq"'::regclass) NOT NULL, 
        ADD COLUMN IF NOT EXISTS "lastUpdated" timestamp with time zone;;
    `);
    console.log('Table "ResourceDateTimeAttributes" updateSequence, lastUpdated columns added');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceNumberAttributes" 
        ADD COLUMN IF NOT EXISTS "updateSequence" bigint DEFAULT nextval('resources."Resources_updates_seq"'::regclass) NOT NULL,
        ADD COLUMN IF NOT EXISTS "lastUpdated" timestamp with time zone;
    `);
    console.log('Table "ResourceNumberAttributes" updateSequence, lastUpdated columns added');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceBooleanAttributes" 
        ADD COLUMN IF NOT EXISTS "updateSequence" bigint DEFAULT nextval('resources."Resources_updates_seq"'::regclass) NOT NULL, 
        ADD COLUMN IF NOT EXISTS "lastUpdated" timestamp with time zone;
    `);
    console.log('Table "ResourceBooleanAttributes" updateSequence, lastUpdated columns added');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceStringReferenceAttributes" 
        ADD COLUMN IF NOT EXISTS "updateSequence" bigint DEFAULT nextval('resources."Resources_updates_seq"'::regclass) NOT NULL,
    `);
    console.log('Table "ResourceStringReferenceAttributeValues" updateSequence column added');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceStringReferenceAttributeValues" 
        ADD COLUMN IF NOT EXISTS "updateSequence" bigint DEFAULT nextval('resources."Resources_updates_seq"'::regclass) NOT NULL,
        ADD COLUMN IF NOT EXISTS "lastUpdated" timestamp with time zone;
    `);
    console.log(
      'Table "ResourceStringReferenceAttributeValues" updateSequence, lastUpdated columns added',
    );

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"()
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
    console.log('Function "ResourcesLookupTables_updateSequence_trigger" reverted.');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceReferenceStringAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceReferenceStringAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceReferenceStringAttributes_update_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceDateTimeAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceDateTimeAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceDateTimeAttributes_update_trigger created');

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
      CREATE TRIGGER "ResourceBooleanAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceBooleanAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceBooleanAttributes_update_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceReferenceStringAttributes_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceReferenceStringAttributes"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceReferenceStringAttributes_update_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceReferenceStringAttributeValues_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceReferenceStringAttributeValues"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceReferenceStringAttributeValues_update_trigger created');
  },
};
