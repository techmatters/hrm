'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      CREATE SCHEMA IF NOT EXISTS resources AUTHORIZATION resources;
    `);
    console.log('Created "resources" schema');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
    DROP SCHEMA IF EXISTS resources;
    `);
    console.log('Dropped "resources" schema');
  },
};
