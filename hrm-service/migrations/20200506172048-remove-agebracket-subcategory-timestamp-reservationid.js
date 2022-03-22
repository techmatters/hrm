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
