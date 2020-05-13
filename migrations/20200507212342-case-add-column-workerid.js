module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Cases', 'twilioWorkerId', { type: Sequelize.STRING });
  },
  down: queryInterface => {
    return queryInterface.removeColumn('Cases', 'twilioWorkerId');
  },
};
