module.exports = {
  // Return a promise to correctly handle asynchronicity.
  up: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.addColumn('Contacts', 'accountSid', Sequelize.STRING),
      queryInterface.addColumn('Cases', 'accountSid', Sequelize.STRING),
      queryInterface.addColumn('CaseAudits', 'accountSid', Sequelize.STRING),
    ]),

  // Return a promise to correctly handle asynchronicity.
  down: queryInterface =>
    Promise.all([
      queryInterface.removeColumn('Contacts', 'accountSid'),
      queryInterface.removeColumn('Cases', 'accountSid'),
      queryInterface.removeColumn('CaseAudits', 'accountSid'),
    ]),
};
