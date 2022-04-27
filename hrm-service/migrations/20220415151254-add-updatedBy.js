'use strict';

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."Cases"
      ADD COLUMN "updatedBy" text COLLATE pg_catalog."default";
    `);
    console.log('"updatedBy" column added to table "Cases"');

    await queryInterface.sequelize.query(`
    ALTER TABLE IF EXISTS public."Contacts"
    ADD COLUMN "updatedBy" text COLLATE pg_catalog."default";
    `);
    console.log('"updatedBy" column added to table "Contacts"');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Cases" 
      DROP COLUMN IF EXISTS "updatedBy";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Contacts" 
      DROP COLUMN IF EXISTS "updatedBy";
    `);
  },
};
