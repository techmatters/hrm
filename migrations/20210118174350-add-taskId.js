module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Contacts', 'taskId', { type: Sequelize.STRING });
  },

  down: queryInterface => {
    return queryInterface.removeColumn('Contacts', 'taskId');
  },
};
