module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Cases', {
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
      status: { type: Sequelize.STRING },
      helpline: { type: Sequelize.STRING },
      info: { type: Sequelize.JSONB },
    });
  },
  down: queryInterface => {
    return queryInterface.dropTable('Cases');
  },
};
