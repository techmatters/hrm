'use strict';

module.exports = {
  up: async queryInterface => {
    // Modify Cases PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."Cases" DROP CONSTRAINT "Cases_pkey" CASCADE;',
    );
    console.log('Dropped PK from "Cases"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."Cases" ADD PRIMARY KEY ("id", "accountSid");',
    );
    console.log('Added new PK to "Cases"');

    // Modify Contacts PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."Contacts" DROP CONSTRAINT "Contacts_pkey" CASCADE;',
    );
    console.log('Dropped PK from "Contacts"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."Contacts" ADD PRIMARY KEY ("id", "accountSid");',
    );
    console.log('Added new PK to "Contacts"');

    // Modify PostSurveys PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."PostSurveys" DROP CONSTRAINT "PostSurveys_pkey" CASCADE;',
    );
    console.log('Dropped PK from "PostSurveys"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."PostSurveys" ADD PRIMARY KEY ("id", "accountSid");',
    );
    console.log('Added new PK to "PostSurveys"');

    // Modify CSAMReports PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."CSAMReports" DROP CONSTRAINT "CSAMReports_pkey" CASCADE;',
    );
    console.log('Dropped PK from "CSAMReports"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."CSAMReports" ADD PRIMARY KEY ("id", "accountSid");',
    );
    console.log('Added new PK to "CSAMReports"');

    // Contacts references Cases (FK)
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Contacts" ADD CONSTRAINT "Contacts_caseId_accountSid_fkey" FOREIGN KEY ("caseId", "accountSid") 
        REFERENCES public."Cases" ("id", "accountSid") MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    `);
    console.log('Added new FK to "Contacts" referencing "Cases"');

    // CSAMReports references Contacts (FK)
    await queryInterface.sequelize.query(`
      ALTER TABLE public."CSAMReports" ADD CONSTRAINT "CSAMReports_contactId_accountSid_fkey" FOREIGN KEY ("contactId", "accountSid") 
        REFERENCES public."Contacts" ("id", "accountSid") MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    `);
    console.log('Added new FK to "CSAMReports" referencing "Contacts"');

    // Add accountSid column to CaseSections
    await queryInterface.sequelize.query(`
      ALTER TABLE public."CaseSections" ADD COLUMN IF NOT EXISTS "accountSid" character varying(255) COLLATE pg_catalog."default";
    `);

    // Backfill CaseSections accountSid using parent Case record
    await queryInterface.sequelize.query(`
      UPDATE "CaseSections" cs SET "accountSid" = "c"."accountSid" FROM "Cases" "c" WHERE cs."caseId" = "c"."id";
    `);

    // Mark CaseSections accountSid as NOT NULL
    await queryInterface.sequelize.query(`
      ALTER TABLE "CaseSections" ALTER COLUMN "accountSid" SET NOT NULL;
    `);
    console.log(
      'Added "accountSid" column to "CaseSections" table, backfilled with parent "Case" info',
    );

    // CaseSections references Cases (FK)
    await queryInterface.sequelize.query(`
      ALTER TABLE public."CaseSections" ADD CONSTRAINT "CaseSections_caseId_accountSid_fkey" FOREIGN KEY ("caseId", "accountSid") 
        REFERENCES public."Cases" (id, "accountSid") MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE;
    `);
    console.log('Added new FK to "CaseSections" referencing "Cases"');
  },

  down: async queryInterface => {},
};
