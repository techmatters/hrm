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
  // Return a promise to correctly handle asynchronicity, using queryInterface.sequelize.transaction so that all operations would be executed successfully or none of the changes would be made.
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('Contacts', 'createdBy', Sequelize.STRING, { transaction: t }),
        queryInterface.addColumn('Cases', 'createdBy', Sequelize.STRING, { transaction: t }),
        queryInterface.addColumn('CaseAudits', 'createdBy', Sequelize.STRING, { transaction: t }),
      ]);
    });
  },

  // Return a promise to correctly handle asynchronicity, using queryInterface.sequelize.transaction so that all operations would be executed successfully or none of the changes would be made.
  down: queryInterface => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.removeColumn('Contacts', 'createdBy', { transaction: t }),
        queryInterface.removeColumn('Cases', 'createdBy', { transaction: t }),
        queryInterface.removeColumn('CaseAudits', 'createdBy', { transaction: t }),
      ]);
    });
  },
};
