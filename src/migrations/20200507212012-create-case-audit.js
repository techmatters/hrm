module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CaseAudits', {
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
      caseId: {
        type: Sequelize.INTEGER,
        references: { model: 'Cases', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      twilioWorkerId: { type: Sequelize.STRING },
      previousValue: { type: Sequelize.JSONB },
      newValue: { type: Sequelize.JSONB },
    });
  },
  down: queryInterface => {
    return queryInterface.dropTable('CaseAudits');
  },
};
