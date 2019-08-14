'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('Subcategories', [
      {
        categoryId: 1, // NOTE: NOT ROBUST 
        subcategory: 'Emotional abuse'
      },
      {
        categoryId: 1, // NOTE: NOT ROBUST 
        subcategory: 'Gang violence'
      },
      {
        categoryId: 2, // NOTE: NOT ROBUST 
        subcategory: 'Emotional Bullying'
      },
      {
        categoryId: 2, // NOTE: NOT ROBUST 
        subcategory: 'Physical Bullying'
      },
      {
        categoryId: 3, // NOTE: NOT ROBUST 
        subcategory: 'Alcohol addiction'
      },
      {
        categoryId: 3, // NOTE: NOT ROBUST 
        subcategory: 'Alcohol experimentation'
      },
      {
        categoryId: 4, // NOTE: NOT ROBUST 
        subcategory: 'Access to HIV/AIDS Medication and Healthcare'
      },
      {
        categoryId: 4, // NOTE: NOT ROBUST 
        subcategory: 'Child living with HIV/AIDS'
      },
    ], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Subcategories', null, {});
  }
};
