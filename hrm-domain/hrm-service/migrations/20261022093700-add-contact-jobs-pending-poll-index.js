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

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS public."ContactJobs_pending_poll_idx";

      CREATE INDEX IF NOT EXISTS "ContactJobs_pending_poll_idx"
          ON public."ContactJobs" USING btree
          ("lastAttempt" ASC NULLS LAST)
          TABLESPACE pg_default
          WHERE completed IS NULL AND "numberOfAttempts" < 20;
    `);
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS public."ContactJobs_pending_poll_idx";`,
    );
  },
};
