'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    /// ProfileSections
    await queryInterface.sequelize.query(`
    CREATE SEQUENCE IF NOT EXISTS public."ProfileSections_id_seq"
      INCREMENT 1
      START 1
      MINVALUE 1
      MAXVALUE 9223372036854775807
      CACHE 1;
   `);
    console.log('Sequence "ProfileSections_id_seq" created');
    await queryInterface.sequelize.query(`
      ALTER SEQUENCE public."ProfileSections_id_seq" OWNER TO hrm
   `);
    console.log("Sequence 'ProfileSections_id_seq' ownership altered.");
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ProfileSections"
      (
        "id" integer COLLATE pg_catalog."default" NOT NULL DEFAULT nextval('"ProfileSections_id_seq"'::regclass),
        "sectionType" text COLLATE pg_catalog."default" NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "profileId" integer NOT NULL,
        "content" text COLLATE pg_catalog."default",
        "createdBy" text COLLATE pg_catalog."default" NOT NULL,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedBy" text COLLATE pg_catalog."default",
        "updatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "ProfileSections_pkey" PRIMARY KEY ("id", "accountSid"),
        CONSTRAINT "ProfileSections_profileId_Profiles_id_fk" FOREIGN KEY ("profileId", "accountSid")
          REFERENCES public."Profiles" (id, "accountSid") MATCH SIMPLE
          ON UPDATE CASCADE
          ON DELETE CASCADE
      )
    `);
    console.log("Table 'ProfileSections' created.");
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ProfileSections" OWNER to hrm;
    `);
    console.log("Table 'ProfileSections' ownership altered.");
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "fki_ProfileSections_profileId_Profile_id_fk" ON public."ProfileSections" USING btree 
        ("profileId" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "fki_ProfileSections_profileId_Profile_id_fk"
    `);
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS public."ProfileSections"
    `);
    await queryInterface.sequelize.query(`
      DROP SEQUENCE IF EXISTS public."ProfileSections_id_seq"
    `);
  },
};
