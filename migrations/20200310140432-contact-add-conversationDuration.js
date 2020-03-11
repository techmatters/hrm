
module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn(
    'Contacts',
    'conversationDuration',
    Sequelize.INTEGER,
  ),

  down: (queryInterface) => queryInterface.removeColumn('Contacts', 'conversationDuration'),
};
