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
    await queryInterface.sequelize.query(
      `ALTER TABLE public."Cases" ADD COLUMN IF NOT EXISTS "label" character varying(255) COLLATE pg_catalog."default";`,
    );
    console.info('ADDED label column to Cases table');
  },
  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `ALTER TABLE public."Cases" DROP COLUMN IF EXISTS "label";`,
    );
    console.info('DROPPED label column from Cases table');
  },
};
