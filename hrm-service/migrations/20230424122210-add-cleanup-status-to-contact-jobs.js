'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE TYPE contactJobCleanupStatus AS ENUM ('pending', 'active', 'complete');`,
    );
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobs"
          ADD COLUMN IF NOT EXISTS "cleanupStatus" contactJobCleanupStatus;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobs"
          DROP COLUMN IF EXISTS "cleanupStatus";
    `);
    await queryInterface.sequelize.query(`DROP TYPE contactJobCleanupStatus;`);
  },
};
