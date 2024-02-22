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

/**
 * This test suit intends to test that the audit_trigger function is set for the target tables and row operations and working as expected.
 * The shape of the json columns of each table have been simplified to avoid noise in this tests.
 */

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Profiles_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON public."Profiles"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger Profiles_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ProfilesToIdentifiers_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON public."ProfilesToIdentifiers"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger ProfilesToIdentifiers_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ProfilesToProfileFlags_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE 
      ON public."ProfilesToProfileFlags"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger ProfilesToProfileFlags_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ProfileFlags_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE
      ON public."ProfileFlags"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger ProfileFlags_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "ProfileSections_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE
      ON public."ProfileSections"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger ProfileSections_audit_trigger created');

    await queryInterface.sequelize.query(`
      CREATE TRIGGER "Identifiers_audit_trigger"
      AFTER INSERT OR DELETE OR UPDATE
      ON public."Identifiers"
      FOR EACH ROW
      EXECUTE FUNCTION public.audit_trigger();
    `);
    console.log('Trigger Identifiers_audit_trigger created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "Profiles_audit_trigger" ON public."Profiles";
    `);
    console.log('Trigger Profiles_audit_trigger dropped');

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ProfilesToIdentifiers_audit_trigger" ON public."ProfilesToIdentifiers";
    `);
    console.log('Trigger ProfilesToIdentifiers_audit_trigger dropped');

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ProfilesToProfileFlags_audit_trigger" ON public."ProfilesToProfileFlags";
    `);
    console.log('Trigger ProfilesToProfileFlags_audit_trigger dropped');

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ProfileFlags_audit_trigger" ON public."ProfileFlags";
    `);
    console.log('Trigger ProfileFlags_audit_trigger dropped');

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "ProfileSections_audit_trigger" ON public."ProfileSections";
    `);
    console.log('Trigger ProfileSections_audit_trigger dropped');

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS "Identifiers_audit_trigger" ON public."Identifiers";
    `);
    console.log('Trigger Identifiers_audit_trigger dropped');
  },
};
