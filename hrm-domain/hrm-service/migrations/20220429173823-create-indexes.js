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
