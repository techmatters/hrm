'use strict';

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS public."Audits_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1;`,
    );
    console.log('Sequence "Audits_id_seq" created');

    await queryInterface.sequelize.query(`ALTER SEQUENCE public."Audits_id_seq" OWNER TO hrm`);
    console.log('Sequence "Audits_id_seq" ownership altered.');

    await queryInterface.sequelize.query(
      `CREATE TABLE IF NOT EXISTS public."Audits"
      (
        id integer NOT NULL DEFAULT nextval('"Audits_id_seq"'::regclass),
        "tableName" text NOT NULL,
        "targetPK" text NOT NULL,
        operation text NOT NULL,
        "updatedBy" text,
        "previousRecord" jsonb,
        timestamp_trx timestamp with time zone NOT NULL,
        timestamp_stm timestamp with time zone NOT NULL,
        timestamp_clock timestamp with time zone NOT NULL,
        PRIMARY KEY (id)
      );`,
    );
    console.log('Table "Audits" created');

    await queryInterface.sequelize.query(`ALTER TABLE IF EXISTS public."Audits" OWNER TO hrm`);
    console.log('Table "Audits" ownership altered.');

    await queryInterface.sequelize.query(`
      CREATE FUNCTION public.audit_trigger()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        NOT LEAKPROOF
      AS $BODY$
      DECLARE
        audit_row public."Audits";
        "targetPK" text;
        "updatedBy" text;
      BEGIN
        IF TG_WHEN <> 'AFTER' THEN
          RAISE EXCEPTION 'audit_trigger() may only run as an AFTER trigger';
        END IF;

        IF (TG_OP = 'UPDATE' AND TG_LEVEL = 'ROW') THEN
          "updatedBy" = NEW."updatedBy";
          IF (TG_TABLE_NAME = 'CaseSections') THEN
            "targetPK" = concat(NEW."caseId", NEW."sectionType", NEW."sectionId");
          ELSE
            "targetPK" = NEW."id";
          END IF;
        ELSIF (TG_OP = 'INSERT' AND TG_LEVEL = 'ROW') THEN
          "updatedBy" = NEW."createdBy";
          IF (TG_TABLE_NAME = 'CaseSections') THEN
            "targetPK" = concat(NEW."caseId", NEW."sectionType", NEW."sectionId");
          ELSE
            "targetPK" = NEW."id";
          END IF;
        ELSIF (TG_OP = 'DELETE' AND TG_LEVEL = 'ROW') THEN
          "updatedBy" = NULL;
          IF (TG_TABLE_NAME = 'CaseSections') THEN
            "targetPK" = concat(OLD."caseId", OLD."sectionType", OLD."sectionId");
          ELSE
            "targetPK" = OLD."id";
          END IF;
        ELSE
          RAISE EXCEPTION 'audit_trigger() added as trigger for unhandled case: %, %',TG_OP, TG_LEVEL;
          RETURN NULL;
        END IF;
        
        audit_row = ROW(
          nextval('"Audits_id_seq"'::regclass), -- new audit id
          TG_TABLE_NAME,                        -- target tabla name
          "targetPK",                           -- target row primary key
          TG_OP,                                -- operation performed on target row
          "updatedBy",                          -- who's performing the above operation on the target row
          to_jsonb(OLD),                        -- target record previous state
          current_timestamp,                    -- transaction timestamp
          statement_timestamp(),                -- statement timestamp
          clock_timestamp()                     -- Current date and time (changes during statement execution)
        );

        INSERT INTO public."Audits" VALUES (audit_row.*);
        RETURN NULL;
      END
      $BODY$;
    `);
    console.log('Function "audit_trigger" created.');

    await queryInterface.sequelize.query(`ALTER FUNCTION public.audit_trigger() OWNER TO hrm`);
    console.log('Function "audit_trigger" ownership altered.');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Cases_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON public."Cases"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger Cases_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "CaseSections_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON public."CaseSections"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger CaseSections_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Contacts_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON public."Contacts"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger Contacts_audit_trigger created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "Contacts_audit_trigger" ON public."Contacts";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "CaseSections_audit_trigger" ON public."CaseSections";`,
    );
    await queryInterface.sequelize.query(
      `DROP TRIGGER IF EXISTS "Cases_audit_trigger" ON public."Cases";`,
    );
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS public.audit_trigger();`);
    await queryInterface.sequelize.query(`DROP TABLE public."Audits"`);
    await queryInterface.sequelize.query(`DROP SEQUENCE public."Audits_id_seq"`);
  },
};
