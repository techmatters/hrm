module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Contacts', 'caseId', {
      type: Sequelize.INTEGER,
      references: { model: 'Cases', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  down: queryInterface => queryInterface.removeColumn('Contacts', 'caseId'),
};
