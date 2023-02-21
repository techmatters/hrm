'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "Referrals_contactId_accountSid_idx" ON public."Referrals" 
      USING btree ("contactId", "accountSid");
    `);
    console.log('Index Referrals_contactId_accountSid_idx created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "Referrals_contactId_accountSid_idx";
    `);
    console.log('Index Referrals_contactId_accountSid_idx dropped');
  },
};
