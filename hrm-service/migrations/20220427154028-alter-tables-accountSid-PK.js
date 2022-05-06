'use strict';

module.exports = {
  up: async queryInterface => {
    // Remove cases without account ID
    await queryInterface.sequelize.query('DELETE FROM public."Cases" WHERE "accountSid" IS NULL');
    console.log('Removed cases with NULL accountSid');
    // Modify Cases PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."Cases" DROP CONSTRAINT IF EXISTS "Cases_pkey" CASCADE;',
    );
    console.log('Dropped PK from "Cases"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."Cases" ADD PRIMARY KEY ("id", "accountSid");',
    );
    console.log('Added new PK to "Cases"');

    // Remove cases without account ID
    await queryInterface.sequelize.query(
      'DELETE FROM public."Contacts" WHERE "accountSid" IS NULL',
    );
    console.log('Removed contacts with NULL accountSid');
    // Modify Contacts PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."Contacts" DROP CONSTRAINT IF EXISTS "Contacts_pkey" CASCADE;',
    );
    console.log('Dropped PK from "Contacts"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."Contacts" ADD PRIMARY KEY ("id", "accountSid");',
    );
    console.log('Added new PK to "Contacts"');

    // Modify PostSurveys PK
    await queryInterface.sequelize.query(
      'DELETE FROM public."PostSurveys" WHERE "accountSid" IS NULL',
    );
    console.log('Removed PostSurveys with NULL accountSid');
    await queryInterface.sequelize.query(
      'ALTER TABLE public."PostSurveys" DROP CONSTRAINT IF EXISTS "PostSurveys_pkey" CASCADE;',
    );
    console.log('Dropped PK from "PostSurveys"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."PostSurveys" ADD PRIMARY KEY ("id", "accountSid");',
    );
    console.log('Added new PK to "PostSurveys"');

    // Modify CSAMReports PK
    await queryInterface.sequelize.query(
      'DELETE FROM public."CSAMReports" WHERE "accountSid" IS NULL',
    );
    console.log('Removed CSAMReports with NULL accountSid');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."CSAMReports" DROP CONSTRAINT IF EXISTS "CSAMReports_pkey" CASCADE;',
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

  down: async queryInterface => {
    // Revert Cases PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."Cases" DROP CONSTRAINT IF EXISTS "Cases_pkey" CASCADE;',
    );
    console.log('Dropped PK from "Cases"');

    await queryInterface.sequelize.query('ALTER TABLE public."Cases" ADD PRIMARY KEY ("id");');
    console.log('Reverted PK to "Cases"');

    // Revert Contacts PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."Contacts" DROP CONSTRAINT IF EXISTS "Contacts_pkey" CASCADE;',
    );
    console.log('Dropped PK from "Contacts"');

    await queryInterface.sequelize.query('ALTER TABLE public."Contacts" ADD PRIMARY KEY ("id");');
    console.log('Reverted PK to "Contacts"');

    // Revert PostSurveys PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."PostSurveys" DROP CONSTRAINT IF EXISTS "PostSurveys_pkey" CASCADE;',
    );
    console.log('Dropped PK from "PostSurveys"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."PostSurveys" ADD PRIMARY KEY ("id");',
    );
    console.log('Reverted PK to "PostSurveys"');

    // Revert CSAMReports PK
    await queryInterface.sequelize.query(
      'ALTER TABLE public."CSAMReports" DROP CONSTRAINT IF EXISTS "CSAMReports_pkey" CASCADE;',
    );
    console.log('Dropped PK from "CSAMReports"');

    await queryInterface.sequelize.query(
      'ALTER TABLE public."CSAMReports" ADD PRIMARY KEY ("id");',
    );
    console.log('Reverted PK to "CSAMReports"');

    // Contacts references Cases (FK)
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Contacts" ADD CONSTRAINT "Contacts_caseId_fkey" FOREIGN KEY ("caseId")
        REFERENCES public."Cases" ("id") MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    `);
    console.log('Reverted FK to "Contacts" referencing "Cases"');

    // CSAMReports references Contacts (FK)
    await queryInterface.sequelize.query(`
      ALTER TABLE public."CSAMReports" ADD CONSTRAINT "CSAMReports_contactId_fkey" FOREIGN KEY ("contactId")
        REFERENCES public."Contacts" ("id") MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
    `);
    console.log('Reverted FK to "CSAMReports" referencing "Contacts"');

    // Remove accountSid column from CaseSections
    await queryInterface.sequelize.query(`
      ALTER TABLE public."CaseSections" DROP COLUMN IF EXISTS "accountSid" CASCADE;
    `);
    console.log('Removed "accountSid" column from "CaseSections" table');

    // CaseSections references Cases (FK)
    await queryInterface.sequelize.query(`
      ALTER TABLE public."CaseSections" ADD CONSTRAINT "CaseSections_caseId_fkey" FOREIGN KEY ("caseId")
        REFERENCES public."Cases" (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE;
    `);
    console.log('Added new FK to "CaseSections" referencing "Cases"');
  },
};
