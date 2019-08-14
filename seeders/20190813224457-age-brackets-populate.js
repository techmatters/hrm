'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('AgeBrackets', [
      {
        bracket: '0-3',
        min: 0,
        max: 3
      },
      {
        bracket: '4-6',
        min: 4,
        max: 6
      },
      {
        bracket: '7-9',
        min: 7,
        max: 9
      },
      {
        bracket: '10-12',
        min: 10,
        max: 12
      },
      {
        bracket: '13-15',
        min: 13,
        max: 15
      },
      {
        bracket: '16-17',
        min: 16,
        max: 17
      },
      {
        bracket: '18-25',
        min: 18,
        max: 25
      },
      {
        bracket: '>25',
        min: 26,
        max: 120
      },
      {
        bracket: 'Unknown',
        min: null,
        max: null
      }
    ], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('AgeBrackets', null, {});
  }
};
