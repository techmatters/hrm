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
      CREATE TABLE IF NOT EXISTS resources."ResourceReferenceStringAttributeValues"
      (
        id text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "value" text COLLATE pg_catalog."default" NOT NULL,
        "language" text COLLATE pg_catalog."default" NOT NULL,
        "info" JSONB,
        "lastUpdated" timestamp with time zone,
        "updateSequence"  bigint NOT NULL DEFAULT nextval('"Resources_updates_seq"'::regclass),
        CONSTRAINT "ResourceReferenceStringAttributeValues_pkey" PRIMARY KEY (id, "accountSid")
      )
    `);
    console.log('Table "ResourceReferenceStringAttributeValues" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceReferenceStringAttributeValues"
          OWNER to resources;
    `);
    console.log('Table "ResourceReferenceStringAttributeValues" now owned by resources');

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceReferenceStringAttributeValues_update_trigger"
      ON resources."ResourceReferenceStringAttributeValues"
    `);
    console.log(
      'Trigger ResourceReferenceStringAttributeValues_update_trigger dropped (if it existed)',
    );
    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceReferenceStringAttributeValues_update_trigger"
      BEFORE UPDATE
      ON resources."ResourceReferenceStringAttributeValues"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."ResourcesLookupTables_updateSequence_trigger"();
    `);
    console.log('Trigger ResourceReferenceStringAttributeValues_update_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS resources."ResourceReferenceStringAttributes"
      (
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "resourceId" text COLLATE pg_catalog."default" NOT NULL,
        "key" text COLLATE pg_catalog."default" NOT NULL,
        "referenceId" text COLLATE pg_catalog."default" NOT NULL,
        "updateSequence"  bigint NOT NULL DEFAULT nextval('"Resources_updates_seq"'::regclass),
        CONSTRAINT "ResourceReferenceStringAttribute_pkey" PRIMARY KEY ("resourceId", "accountSid", "key", "referenceId"),
        CONSTRAINT "FK_ResourceReferenceStringAttributes_Resources" FOREIGN KEY ("resourceId", "accountSid")
            REFERENCES resources."Resources" (id, "accountSid") MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE,
        CONSTRAINT "FK_ResourceReferenceStringAttributes_ResourceReferenceStringAttributeValues" FOREIGN KEY ("referenceId", "accountSid")
            REFERENCES resources."ResourceReferenceStringAttributeValues" (id, "accountSid") MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE
      )
    `);
    console.log('Table "ResourceReferenceStringAttributes" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ResourceReferenceStringAttributes"
          OWNER to resources;
    `);
    console.log('Table "ResourceReferenceStringAttributes" now owned by resources');

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ResourceReferenceStringAttributes_update_trigger"
      ON resources."ResourceReferenceStringAttributes";
    `);
    console.log('Trigger ResourceReferenceStringAttributes_update_trigger dropped (if it existed)');

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
      ALTER TABLE resources."ResourceStringAttributes" ADD COLUMN IF NOT EXISTS "id" BIGSERIAL;
    `);
    console.log('Added id serial column to ResourceStringAttributes');
    await queryInterface.sequelize.query(`
      ALTER TABLE resources."ResourceStringAttributes" DROP CONSTRAINT IF EXISTS "FK_ResourceStringAttributes_Resources";
    `);
    console.log('Temporarily dropped ResourceStringAttributes foreign key constraint');
    await queryInterface.sequelize.query(`
      ALTER TABLE resources."ResourceStringAttributes" DROP CONSTRAINT IF EXISTS "ResourceStringAttributes_pkey";
    `);
    console.log('Removed ResourceStringAttributes old primary key');
    await queryInterface.sequelize.query(`
      ALTER TABLE resources."ResourceStringAttributes" ADD PRIMARY KEY (id, "accountSid");
    `);
    console.log('Added ResourceStringAttributes unique constraint in place of old primary key');
    await queryInterface.sequelize.query(`
      ALTER TABLE resources."ResourceStringAttributes" ADD CONSTRAINT "FK_ResourceStringAttributes_Resources" FOREIGN KEY ("resourceId", "accountSid")
            REFERENCES resources."Resources" (id, "accountSid") MATCH SIMPLE
            ON UPDATE CASCADE
            ON DELETE CASCADE;
    `);
    console.log('Put back temporarily removed ResourceStringAttributes foreign key constraint');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS resources."ResourceReferenceStringAttributes"`,
    );
    console.log('Table "ResourceReferenceStringAttributes" dropped');
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS resources."ResourceReferenceStringAttributeValues"`,
    );
    console.log('Table "ResourceReferenceStringAttributeValues" dropped');
  },
};
