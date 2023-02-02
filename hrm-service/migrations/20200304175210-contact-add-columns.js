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
  up: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.addColumn('Contacts', 'twilioWorkerId', { type: Sequelize.STRING }),
      queryInterface.addColumn('Contacts', 'helpline', { type: Sequelize.STRING }),
      queryInterface.addColumn('Contacts', 'number', { type: Sequelize.STRING }),
      queryInterface.addColumn('Contacts', 'channel', { type: Sequelize.STRING }),
    ]),

  down: queryInterface =>
    Promise.all([
      queryInterface.removeColumn('Contacts', 'twilioWorkerId'),
      queryInterface.removeColumn('Contacts', 'helpline'),
      queryInterface.removeColumn('Contacts', 'number'),
      queryInterface.removeColumn('Contacts', 'channel'),
    ]),
};
