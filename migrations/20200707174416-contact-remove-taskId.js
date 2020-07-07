'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.removeColumn('Contacts', 'taskId'),

  down: (queryInterface, Sequelize) =>
    queryInterface.addColumn('Contacts', 'taskId', Sequelize.STRING),
};
