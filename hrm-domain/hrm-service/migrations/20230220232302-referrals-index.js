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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Referrals" ALTER CONSTRAINT "FK_Referrals_Contacts" DEFERRABLE INITIALLY DEFERRED;
    `);
    console.log(
      'Constraint "FK_Referrals_Contacts" altered (DEFERRABLE INITIALLY DEFERRED)',
    );

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
