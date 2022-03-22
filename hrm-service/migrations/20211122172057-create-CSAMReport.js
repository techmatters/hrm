module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('CSAMReports', {
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
      twilioWorkerId: { type: Sequelize.STRING },
      csamReportId: { type: Sequelize.STRING },
      contactId: {
        type: Sequelize.INTEGER,
        references: { model: 'Contacts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    });
  },
  down: queryInterface => {
    return queryInterface.dropTable('CSAMReports');
  },
};
