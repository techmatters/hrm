module.exports = {
  up: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.addColumn('Contacts', 'twilioWorkerId', { type: Sequelize.STRING }),
      queryInterface.addColumn('Contacts', 'helpline', { type: Sequelize.STRING }),
      queryInterface.addColumn('Contacts', 'number', { type: Sequelize.STRING }),
      queryInterface.addColumn('Contacts', 'channel', { type: Sequelize.STRING }),
    ]),

  down: queryInterface =>
    Promise.all([
      queryInterface.removeColumn('Contacts', 'twilioWorkerId'),
      queryInterface.removeColumn('Contacts', 'helpline'),
      queryInterface.removeColumn('Contacts', 'number'),
      queryInterface.removeColumn('Contacts', 'channel'),
    ]),
};
