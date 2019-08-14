'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('Categories', [
      {
        themeId: 3, // NOTE: NOT ROBUST
        category: 'Abuse and Violence' 
      },
      {
        themeId: 3, // NOTE: NOT ROBUST
        category: 'Bullying'
      },
      {
        themeId: 4, // NOTE: NOT ROBUST
        category: 'Addiction'
      },
      {
        themeId: 4, // NOTE: NOT ROBUST
        category: 'HIV/AIDS'
      },
    ], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Categories', null, {});
  }
};
