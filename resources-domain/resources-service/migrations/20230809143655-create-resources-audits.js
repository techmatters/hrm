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
    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS resources."Audits_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1;`,
    );
    console.log('Sequence "Audits_id_seq" created');

    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS resources."Audits"
        (
        id integer NOT NULL DEFAULT nextval('"Audits_id_seq"'::regclass),
        "user" text NOT NULL,
        "tableName" text NOT NULL,
        operation text NOT NULL,
        "oldRecord" jsonb,
        "newRecord" jsonb,
        timestamp_trx timestamp with time zone NOT NULL,
        timestamp_stm timestamp with time zone NOT NULL,
        timestamp_clock timestamp with time zone NOT NULL,
        PRIMARY KEY (id)
        );`,
    );
    console.log('Table "Audits" created');

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION resources.audit_trigger()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        NOT LEAKPROOF
      AS $BODY$
      DECLARE
        resource_audit_row resources."Audits";
      BEGIN
        IF TG_WHEN <> 'AFTER' THEN
          RAISE EXCEPTION 'audit_trigger() may only run as an AFTER trigger';
        END IF;

        IF (TG_LEVEL <> 'ROW' OR (TG_OP <> 'UPDATE' AND TG_OP <> 'INSERT' AND TG_OP <> 'DELETE')) THEN
          RAISE EXCEPTION 'audit_trigger() added as trigger for unhandled case: %, %',TG_OP, TG_LEVEL;
          RETURN NULL;
        END IF;
        
        resource_audit_row = ROW(
          nextval('"Audits_id_seq"'::regclass), -- new audit id
          current_user,                         -- the current DB user
          TG_TABLE_NAME,                        -- target tabla name
          TG_OP,                                -- operation performed on target row
          to_jsonb(OLD),                        -- target record previous state
          to_jsonb(NEW),                        -- target record new state
          current_timestamp,                    -- transaction timestamp
          statement_timestamp(),                -- statement timestamp
          clock_timestamp()                     -- Current date and time (changes during statement execution)
        );

        INSERT INTO resources."Audits" VALUES (resource_audit_row.*);
        RETURN NULL;
      END
      $BODY$;
    `);
    console.log('Function "audit_trigger" created.');

    await queryInterface.sequelize.query(
      `ALTER FUNCTION resources.audit_trigger() OWNER TO resources`,
    );
    console.log('Function "audit_trigger" ownership altered.');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Resources_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."Resources"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger Resources_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceStringAttributes_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."ResourceStringAttributes"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger ResourceStringAttributes_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceReferenceStringAttributeValues_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."ResourceReferenceStringAttributeValues"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger ResourceReferenceStringAttributeValues_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceBooleanAttributes_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."ResourceBooleanAttributes"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger ResourceBooleanAttributes_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceNumberAttributes_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."ResourceNumberAttributes"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger ResourceNumberAttributes_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceDateTimeAttributes_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."ResourceDateTimeAttributes"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger ResourceDateTimeAttributes_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Accounts_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."Accounts"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger Accounts_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ResourceReferenceStringAttributes_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON resources."ResourceReferenceStringAttributes"
      FOR EACH ROW
      EXECUTE FUNCTION resources.audit_trigger();
    `);
    console.log('Trigger ResourceReferenceStringAttributes_audit_trigger created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "Resources_audit_trigger" ON resources."Resources";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "ResourceStringAttributes_audit_trigger" ON resources."ResourceStringAttributes";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "ResourceReferenceStringAttributeValues_audit_trigger" ON resources."ResourceReferenceStringAttributeValues";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "ResourceBooleanAttributes_audit_trigger" ON resources."ResourceBooleanAttributes";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "Accounts_audit_trigger" ON resources."Accounts";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "ResourceDateTimeAttributes_audit_trigger" ON resources."ResourceDateTimeAttributes";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "ResourceNumberAttributes_audit_trigger" ON resources."ResourceNumberAttributes";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "ResourceReferenceStringAttributes_audit_trigger" ON resources."ResourceReferenceStringAttributes";`,
    );
    await queryInterface.sequelize.query(
      `DROP FUNCTION IF EXISTS resources.audit_trigger();`,
    );
    await queryInterface.sequelize.query(`DROP TABLE resources."Audits"`);
    await queryInterface.sequelize.query(`DROP SEQUENCE resources."Audits_id_seq"`);
  },
};
