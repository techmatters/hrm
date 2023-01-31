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
  up: queryInterface =>
    queryInterface.sequelize.transaction(transaction =>
      Promise.all([
        queryInterface.removeColumn('Contacts', 'AgeBracketId', { transaction }),
        queryInterface.removeColumn('Contacts', 'SubcategoryId', { transaction }),
        queryInterface.removeColumn('Contacts', 'timestamp', { transaction }),
        queryInterface.removeColumn('Contacts', 'reservationId', { transaction }),
        queryInterface.dropTable('AgeBrackets', { transaction }),
        queryInterface.dropTable('Subcategories', { transaction }),
      ]),
    ),

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable('AgeBrackets', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        min: { type: Sequelize.INTEGER },
        max: { type: Sequelize.INTEGER },
        bracket: { type: Sequelize.STRING },
      });
      await queryInterface.addColumn('Contacts', 'AgeBracketId', {
        type: Sequelize.INTEGER,
        references: { model: 'AgeBrackets', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.createTable('Subcategories', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        subcategory: { type: Sequelize.STRING },
      });
      await queryInterface.addColumn('Contacts', 'SubcategoryId', {
        type: Sequelize.INTEGER,
        references: { model: 'Subcategories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addColumn('Contacts', 'timestamp', { type: Sequelize.BIGINT });
      await queryInterface.addColumn('Contacts', 'reservationId', { type: Sequelize.STRING });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
