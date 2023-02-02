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
