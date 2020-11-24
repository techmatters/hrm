module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Contacts', 'timeOfContact', { type: Sequelize.DATE });
  },

  down: queryInterface => {
    return queryInterface.removeColumn('Contacts', 'timeOfContact');
  },
};
