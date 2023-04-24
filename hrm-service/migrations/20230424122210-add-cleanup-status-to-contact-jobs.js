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
