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
    await queryInterface.sequelize.query(`CREATE ROLE hrm_service;`);
    console.log('Created hrm_service role');
    await queryInterface.sequelize.query(
      `GRANT CONNECT ON DATABASE hrmdb TO hrm_service`,
    );
    console.log('Granted right to connect to DB to hrm_service role');
    await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA public TO hrm_service`);
    console.log('Granted right to use the public schema to hrm_service role');
    await queryInterface.sequelize.query(
      `GRANT INSERT, UPDATE, DELETE, SELECT ON ALL TABLES IN SCHEMA public TO hrm_service`,
    );
    console.log(
      'Granted read / write access to all existing tables in the public schema',
    );
    await queryInterface.sequelize.query(
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO hrm_service`,
    );
    console.log(
      'Granted read / write access to all existing sequence in the public schema',
    );
    await queryInterface.sequelize.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE, SELECT ON TABLES TO hrm_service`,
    );
    console.log(
      'Added default SELECT, INSERT, UPDATE and DELETE access to tables in the public schema to hrm_service role, so it has access to all new tables',
    );
    await queryInterface.sequelize.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO hrm_service`,
    );
    console.log(
      'Added default access to sequences in the public schema to hrm_service role, in case we create any new schemas',
    );
  },
  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      DROP ROLE hrm_service;
    `);
    console.log('Dropped hrm_service');
  },
};
