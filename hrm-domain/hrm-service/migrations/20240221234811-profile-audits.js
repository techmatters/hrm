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
