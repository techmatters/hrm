module.exports = {
  up: async queryInterface => {
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
      CREATE TABLE IF NOT EXISTS resources."Resources"
      (
        id text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "name" text COLLATE pg_catalog."default" NOT NULL,
        "created" timestamp with time zone NOT NULL DEFAULT NOW(),
        "lastUpdated" timestamp with time zone,
        "updateSequence"  bigint NOT NULL DEFAULT nextval('"Resources_updates_seq"'::regclass),
        CONSTRAINT "Resources_pkey" PRIMARY KEY (id, "accountSid")
      )
    `);
    console.log('Table "Resources" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."Resources"
          OWNER to resources;
    `);
    console.log('Table "Resources" now owned by resources');

    await queryInterface.sequelize.query(`
      CREATE FUNCTION resources."Resources_updateSequence_trigger"()
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
    console.log('Function "Resources_updateSequence_trigger" created.');

    await queryInterface.sequelize.query(
      `ALTER FUNCTION resources."Resources_updateSequence_trigger"() OWNER TO resources`,
    );
    console.log('Function "Resources_updateSequence_trigger" ownership altered.');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Resources_update_trigger"
      AFTER UPDATE 
      ON resources."Resources"
      FOR EACH ROW
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION resources."Resources_updateSequence_trigger"();
    `);
    console.log('Trigger Resources_update_trigger created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS resources."Resources"`);
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS resources."Resources"`);
    await queryInterface.sequelize.query(
      `DROP SEQUENCE IF EXISTS resources."Resources_updates_seq"`,
    );
    console.log('Table "Resources" dropped');
  },
};
