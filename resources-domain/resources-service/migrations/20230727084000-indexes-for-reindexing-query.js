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
      CREATE INDEX IF NOT EXISTS "ResourceStringAttributes_resourceId_accountSid_idx"
        ON resources."ResourceStringAttributes" USING btree
        ("resourceId" ASC NULLS LAST, "accountSid" ASC NULLS LAST);

    `);
    console.log(
      '"ResourceStringAttributes"."ResourceStringAttributes_resourceId_accountSid_idx" index added',
    );
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "Resources_lastUpdated_idx"
        ON resources."Resources" USING btree
        ("lastUpdated" ASC NULLS LAST, "accountSid" ASC NULLS LAST, id ASC NULLS LAST);
    `);
    console.log('"Resources"."Resources_lastUpdated_idx" index added');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS resources."ResourceStringAttributes_resourceId_accountSid_idx";`,
    );
    console.log(
      '"ResourceStringAttributes_resourceId_accountSid_idx" index dropped "ResourceStringAttributes"',
    );
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS resources."Resources_lastUpdated_idx";`,
    );
    console.log('"Resources_lastUpdated_idx" index dropped from "Resources"');
  },
};
