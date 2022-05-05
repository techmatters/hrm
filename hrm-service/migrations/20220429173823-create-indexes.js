'use strict';

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "fki_CaseSections_caseId_Case_id_fk";
    `);
    console.log('Index fki_CaseSections_caseId_Case_id_fk dropped');

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "CaseSections_caseId_accountSid_idx" ON public."CaseSections" 
      USING btree ("caseId", "accountSid");
    `);
    console.log('Index CaseSections_caseId_accountSid_idx created');

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "CSAMReports_contactId_accountSid_idx" ON public."CSAMReports" 
      USING btree ("contactId", "accountSid");
    `);
    console.log('Index CSAMReports_contactId_accountSid_idx created');

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "Contacts_caseId_accountSid_idx" ON public."Contacts" 
      USING btree ("caseId", "accountSid");
    `);
    console.log('Index Contacts_caseId_accountSid_idx created');

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "Contacts_accountSid_idx" ON public."Contacts" 
      USING btree ("accountSid");
    `);
    console.log('Index Contacts_accountSid_idx created');

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "Cases_accountSid_idx" ON public."Cases" 
      USING btree ("accountSid");
    `);
    console.log('Index Cases_accountSid_idx created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "CaseSections_caseId_accountSid_idx";
    `);
    console.log('Index CaseSections_caseId_accountSid_idx dropped');

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "CSAMReports_contactId_accountSid_idx";
    `);
    console.log('Index CSAMReports_contactId_accountSid_idx dropped');

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "Contacts_caseId_accountSid_idx";
    `);
    console.log('Index Contacts_caseId_accountSid_idx dropped');

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "Contacts_accountSid_idx";
    `);
    console.log('Index Contacts_accountSid_idx dropped');

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "Cases_accountSid_idx";
    `);
    console.log('Index Cases_accountSid_idx dropped');

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "fki_CaseSections_caseId_Case_id_fk" ON public."CaseSections" USING btree
        ("caseId" ASC NULLS LAST)
      `);
    console.log('Index fki_CaseSections_caseId_Case_id_fk created');
  },
};
