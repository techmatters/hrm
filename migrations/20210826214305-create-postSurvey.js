module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('PostSurveys', {
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
      accountSid: { type: Sequelize.STRING },
      taskId: { type: Sequelize.STRING },
      contactTaskId: { type: Sequelize.STRING },
      data: { type: Sequelize.JSONB },
    });
  },
  down: queryInterface => {
    return queryInterface.dropTable('PostSurveys');
  },
};
