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

        INSERT INTO resources."Audits" (
          "user", 
          "tableName", 
          "operation", 
          "oldRecord", 
          "newRecord", 
          "timestamp_trx", 
          "timestamp_stm", 
          "timestamp_clock"
        ) VALUES (
          current_user,                         -- the current DB user
          TG_TABLE_NAME,                        -- target tabla name
          TG_OP,                                -- operation performed on target row
          to_jsonb(OLD),                        -- target record previous state
          to_jsonb(NEW),                        -- target record new state
          current_timestamp,                    -- transaction timestamp
          statement_timestamp(),                -- statement timestamp
          clock_timestamp()                     -- Current date and time (changes during statement execution)
        );
        RETURN NULL;
      END
      
      $BODY$;
    `);
    console.log('Function "audit_trigger" updated.');

    await queryInterface.sequelize.query(
      `ALTER FUNCTION resources.audit_trigger() OWNER TO resources`,
    );
    console.log('Function "audit_trigger" ownership altered.');
  },

  down: async queryInterface => {
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
    console.log('Function "audit_trigger" reverted.');
  },
};
