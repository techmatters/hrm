module.exports = {
  up: queryInterface => queryInterface.removeColumn('Contacts', 'taskId'),

  down: (queryInterface, Sequelize) =>
    queryInterface.addColumn('Contacts', 'taskId', Sequelize.STRING),
};
