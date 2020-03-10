'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Contacts',
      'conversationDuration',
      Sequelize.INTEGER,
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Contacts', 'conversationDuration')
  }
};
