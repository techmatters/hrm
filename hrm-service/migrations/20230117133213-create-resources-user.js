'use strict';
require('dotenv').config();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    if (!process.env.RESOURCES_PASSWORD) {
      throw new Error(
        'RESOURCES_PASSWORD env var not provided but required for migration. Please update env vars',
      );
    }

    // GRANT USAGE ON SCHEMA public TO resources;
    await queryInterface.sequelize.query(`
      CREATE USER resources WITH PASSWORD '${process.env.RESOURCES_PASSWORD}' VALID UNTIL 'infinity';
      GRANT CONNECT, CREATE ON DATABASE hrmdb TO resources;
      GRANT SELECT, INSERT ON TABLE public."SequelizeMeta" TO resources;
  `);
    console.log('Created new user "resources"');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`DROP USER resources;`);
    console.log('Droped user "resources"');
  },
};
