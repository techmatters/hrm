'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    // Profiles
    await queryInterface.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS public."Profiles_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1;
    `);
    console.log('Sequence "Profiles_id_seq" created');
    await queryInterface.sequelize.query(`
    ALTER SEQUENCE public."Profiles_id_seq" OWNER TO hrm
    `);
    console.log("Sequence 'Profiles_id_seq' ownership altered.");
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."Profiles"
      (
        id integer NOT NULL DEFAULT nextval('"Profiles_id_seq"'::regclass),
        "name" text COLLATE pg_catalog."default",
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "Profiles_pkey" PRIMARY KEY ("id", "accountSid")
      )
    `);
    console.log("Table 'Profiles' created.");
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."Profiles" OWNER to hrm;
    `);
    console.log("Table 'Profiles' ownership altered.");

    // Identifiers
    await queryInterface.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS public."Identifiers_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1;
    `);
    console.log('Sequence "Identifiers_id_seq" created');
    await queryInterface.sequelize.query(`
    ALTER SEQUENCE public."Identifiers_id_seq" OWNER TO hrm
    `);
    console.log("Sequence 'Identifiers_id_seq' ownership altered.");
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."Identifiers"
      (
        id integer NOT NULL DEFAULT nextval('"Identifiers_id_seq"'::regclass),
        "identifier" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "Identifiers_pkey" PRIMARY KEY ("id", "accountSid")
      )
    `);
    console.log("Table 'Profiles' created.");
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."Profiles" OWNER to hrm;
    `);
    console.log("Table 'Profiles' ownership altered.");

    // ProfileFlags
    await queryInterface.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS public."ProfileFlags_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1;
    `);
    console.log('Sequence "ProfileFlags_id_seq" created');
    await queryInterface.sequelize.query(`
    ALTER SEQUENCE public."ProfileFlags_id_seq" OWNER TO hrm
    `);
    console.log("Sequence 'ProfileFlags_id_seq' ownership altered.");
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ProfileFlags"
      (
        id integer NOT NULL DEFAULT nextval('"ProfileFlags_id_seq"'::regclass),
        "name" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "ProfileFlags_pkey" PRIMARY KEY ("id", "accountSid")
      )
    `);
    console.log("Table 'ProfileFlags' created.");
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ProfileFlags" OWNER to hrm;
    `);
    console.log("Table 'ProfileFlags' ownership altered.");

    //
    // TODO: if we populate the ProfileFlags table, we'll need accountSid, which we have now,
    //       but we wont when a new helpline is added.
    //       Do we have a plan to "auto-populate" this table on new accounts?
    //      Wouldn't be better to let each helpline populate this when they need it?
    //

    // ProfilesToProfileFlags
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ProfilesToProfileFlags"
      (
        "profileId" integer NOT NULL,
        "profileFlagId" integer NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "ProfilesToProfileFlags_pkey" PRIMARY KEY ("profileId", "profileFlagId", "accountSid"),
        CONSTRAINT "ProfilesToProfileFlags_profileId_Profiles_id_fk" FOREIGN KEY ("profileId", "accountSid")
          REFERENCES public."Profiles" (id, "accountSid") MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE,
        CONSTRAINT "ProfilesToProfileFlags_profileFlagId_ProfileFlags_id_fk" FOREIGN KEY ("profileFlagId", "accountSid")
          REFERENCES public."ProfileFlags" (id, "accountSid") MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE
      )
    `);
    console.log("Table 'ProfilesToProfileFlags' created.");
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ProfilesToProfileFlags" OWNER to hrm;
    `);
    console.log("Table 'ProfilesToProfileFlags' ownership altered.");
    await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS "fki_ProfilesToProfileFlags_profileId_accountSid_Profiles_id_accountSid_fk" ON public."ProfilesToProfileFlags" USING btree
      ("profileId" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    `);
    console.log(
      "Index 'fki_ProfilesToProfileFlags_profileId_accountSid_Profiles_id_accountSid_fk' created.",
    );
    await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS "fki_ProfilesToProfileFlags_profileFlagId_accountSid_ProfileFlags_id_accountSid_fk" ON public."ProfilesToProfileFlags" USING btree
      ("profileFlagId" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    `);
    console.log(
      "Index 'fki_ProfilesToProfileFlags_profileFlagId_accountSid_ProfileFlags_id_accountSid_fk' created.",
    );

    // ProfilesToIdentifiers
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ProfilesToIdentifiers"
      (
        "profileId" integer NOT NULL,
        "identifierId" integer NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "ProfilesToIdentifiers_pkey" PRIMARY KEY ("profileId", "identifierId", "accountSid"),
        CONSTRAINT "ProfilesToIdentifiers_profileId_Profiles_id_fk" FOREIGN KEY ("profileId", "accountSid")
          REFERENCES public."Profiles" (id, "accountSid") MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE,
        CONSTRAINT "ProfilesToIdentifiers_identifierId_Identifiers_id_fk" FOREIGN KEY ("identifierId", "accountSid")
          REFERENCES public."Identifiers" (id, "accountSid") MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE
      )
    `);
    console.log("Table 'ProfilesToIdentifiers' created.");
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ProfilesToIdentifiers" OWNER to hrm;
    `);
    console.log("Table 'ProfilesToIdentifiers' ownership altered.");
    await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS "fki_ProfilesToIdentifiers_profileId_accountSid_Profiles_id_accountSid_fk" ON public."ProfilesToIdentifiers" USING btree
    ("profileId" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    `);
    console.log(
      "Index 'fki_ProfilesToIdentifiers_identifierId_accountSid_Identifiers_id_accountSid_fk' created.",
    );
    await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS "fki_ProfilesToIdentifiers_identifierId_accountSid_Identifiers_id_accountSid_fk" ON public."ProfilesToIdentifiers" USING btree
    ("identifierId" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    `);
    console.log(
      "Index 'fki_ProfilesToIdentifiers_identifierId_accountSid_Identifiers_id_accountSid_fk' created.",
    );

    // Add existing identifiers to Identifiers table
    await queryInterface.sequelize.query(`
    DO $$    
      DECLARE identifier public."Identifiers";
      DECLARE profile public."Profiles";
    BEGIN
        -- Insert one identifier per distinct numnber-accountSid pair
        INSERT INTO "Identifiers" ("identifier", "accountSid", "createdAt", "updatedAt")
          SELECT DISTINCT "number" as "identifier", "accountSid", current_timestamp as "createdAt", current_timestamp as "updatedAt" 
          FROM "Contacts";
        
          -- For each new Identifier
          FOR identifier IN (SELECT * FROM "Identifiers") LOOP
          -- Create a "blank" Profile
          INSERT INTO "Profiles"("name", "accountSid", "createdAt", "updatedAt")
          VALUES (NULL, identifier."accountSid", current_timestamp, current_timestamp)
          RETURNING * INTO profile;
          
          -- Link the profile to the identifier
          INSERT INTO "ProfilesToIdentifiers"("profileId", "identifierId", "accountSid", "createdAt", "updatedAt")
          VALUES (profile.id, identifier.id, identifier."accountSid", current_timestamp, current_timestamp);
          
          END LOOP;
          END$$  
          `);
    console.log('Profiles, Identifiers and relations populated');

    // Add profileId and identifierId columns to Contacts table
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."Contacts" ADD COLUMN "profileId" integer;

      ALTER TABLE IF EXISTS public."Contacts" ADD CONSTRAINT "Contacts_profileId_Profiles_id_fk"
      FOREIGN KEY ("profileId", "accountSid") REFERENCES public."Profiles" (id, "accountSid") MATCH SIMPLE ON UPDATE CASCADE ON DELETE SET NULL;
      
      ALTER TABLE IF EXISTS public."Contacts" ADD COLUMN "identifierId" integer;
      
      ALTER TABLE IF EXISTS public."Contacts" ADD CONSTRAINT "Contacts_identifierId_Identifiers_id_fk" 
      FOREIGN KEY ("identifierId", "accountSid") REFERENCES public."Identifiers" (id, "accountSid") MATCH SIMPLE ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    // Populate profileId and identifierId columns on Contacts
    await queryInterface.sequelize(`
      DO $$
        DECLARE tmp RECORD;
      BEGIN
        FOR tmp IN (
          SELECT "profileId", "identifierId", "identifier", ids."accountSid" FROM "ProfilesToIdentifiers" p2i
          LEFT JOIN "Identifiers" ids ON p2i."identifierId" = ids.id
        ) LOOP
      
          UPDATE "Contacts" SET "profileId" = tmp."profileId", "identifierId" = tmp."identifierId"
        WHERE "number" = tmp."identifier" AND "accountSid" = tmp."accountSid";
      
        END LOOP;
      END$$
    `);
    console.log(
      '"profileId" and "identifierId" columns added to "Contacts" table and populated',
    );
  },

  down: async queryInterface => {},
};
