'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    const transaction = await queryInterface.sequelize.transaction();

    await queryInterface.sequelize.query(
      `
        ALTER TABLE IF EXISTS public."CSAMReports"
        ADD COLUMN "reportType" TEXT NOT NULL;
      `,
      { transaction },
    );
    console.log('Column reportType added to CSAMReports');

    await queryInterface.sequelize.query(
      `
        ALTER TABLE IF EXISTS public."CSAMReports"
        ADD COLUMN "aknowledged" BOOLEAN NOT NULL;
      `,
      { transaction },
    );
    console.log('Column reportStatus added to CSAMReports');

    await queryInterface.sequelize.query(
      `
        UPDATE "CSAMReports" SET "reportType" = 'counsellor-generated', "aknowledged" = TRUE;
      `,
      { transaction },
    );
    console.log('Set reportType colum to "counsellor-generated" for all records');

    await transaction.commit();
  },

  down: async queryInterface =>
    queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn('CSAMReports', 'reportType', Sequelize.STRING, {
        transaction,
      });
    }),
};
