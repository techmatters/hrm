module.exports = {
  // Return a promise to correctly handle asynchronicity, using queryInterface.sequelize.transaction so that all operations would be executed successfully or none of the changes would be made.
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('Contacts', 'createdBy', Sequelize.STRING, { transaction: t }),
        queryInterface.addColumn('Cases', 'createdBy', Sequelize.STRING, { transaction: t }),
        queryInterface.addColumn('CaseAudits', 'createdBy', Sequelize.STRING, { transaction: t }),
      ]);
    });
  },

  // Return a promise to correctly handle asynchronicity, using queryInterface.sequelize.transaction so that all operations would be executed successfully or none of the changes would be made.
  down: queryInterface => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.removeColumn('Contacts', 'createdBy', { transaction: t }),
        queryInterface.removeColumn('Cases', 'createdBy', { transaction: t }),
        queryInterface.removeColumn('CaseAudits', 'createdBy', { transaction: t }),
      ]);
    });
  },
};
