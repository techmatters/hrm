module.exports = {
  // Return a promise to correctly handle asynchronicity, using queryInterface.sequelize.transaction so that all operations would be executed successfully or none of the changes would be made.
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('Contacts', 'accountSid', Sequelize.STRING, { transaction: t }),
        queryInterface.addColumn('Cases', 'accountSid', Sequelize.STRING, { transaction: t }),
        queryInterface.addColumn('CaseAudits', 'accountSid', Sequelize.STRING, { transaction: t }),
      ]);
    });
  },

  // Return a promise to correctly handle asynchronicity, using queryInterface.sequelize.transaction so that all operations would be executed successfully or none of the changes would be made.
  down: queryInterface => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.removeColumn('Contacts', 'accountSid', { transaction: t }),
        queryInterface.removeColumn('Cases', 'accountSid', { transaction: t }),
        queryInterface.removeColumn('CaseAudits', 'accountSid', { transaction: t }),
      ]);
    });
  },
};
