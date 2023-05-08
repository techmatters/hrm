'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE "ContactJobs"
      SET "cleanupStatus" = 'pending'
      WHERE "completionPayload"->>'message' != 'Attempts limit reached'
    `);
  },

  async down(queryInterface, Sequelize) {
    // There is no going back safely.
  },
};
