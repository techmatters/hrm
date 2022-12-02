'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    const transaction = await queryInterface.sequelize.transaction();

    await queryInterface.sequelize.query(
      `
        ALTER TABLE IF EXISTS public."CSAMReports"
        ADD COLUMN "reportType" TEXT DEFAULT 'counsellor-generated' NOT NULL;
      `,
      { transaction },
    );
    console.log('Column reportType added to CSAMReports');

    await queryInterface.sequelize.query(
      `
        ALTER TABLE IF EXISTS public."CSAMReports"
        ADD COLUMN "acknowledged" BOOLEAN DEFAULT TRUE NOT NULL;
      `,
      { transaction },
    );
    console.log('Column acknowledged added to CSAMReports');

    await queryInterface.sequelize.query(
      `
        ALTER TABLE IF EXISTS public."CSAMReports"
        ALTER COLUMN "reportType" DROP DEFAULT;
      `,
      { transaction },
    );
    console.log('Column reportType default constraint droped');

    await queryInterface.sequelize.query(
      `
        ALTER TABLE IF EXISTS public."CSAMReports"
        ALTER COLUMN "acknowledged" DROP DEFAULT;
      `,
      { transaction },
    );
    console.log('Column acknowledged default constraint droped');

    await transaction.commit();
  },

  down: async queryInterface =>
    queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn('CSAMReports', 'reportType', Sequelize.STRING, {
        transaction,
      });
    }),
};
