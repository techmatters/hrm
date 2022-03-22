module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('Contacts', 'channelSid', Sequelize.STRING, { transaction: t }),
        queryInterface.addColumn('Contacts', 'serviceSid', Sequelize.STRING, { transaction: t }),
      ]);
    });
  },

  down: queryInterface => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.removeColumn('Contacts', 'channelSid', { transaction: t }),
        queryInterface.removeColumn('Contacts', 'serviceSid', { transaction: t }),
      ]);
    });
  },
};
