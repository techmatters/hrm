'use strict';

// As is, returns:
//   ERROR: Category is not defined
// Even with all the current commenting-out. Must be due to
// trying to include 'categories' in the insert?
// I most likely need to understand how associations work better. 
// For now, just do these manually
// TODO(nick): make this actually work
module.exports = {
  up: (queryInterface, Sequelize) => {
    // const sequelize = new Sequelize('postgres://hrm@localhost:5432/hrmdb');
    // const ThemeModel = require('../models/theme.js')
    // const Theme = ThemeModel(sequelize, Sequelize); 
    // const CategoryModel = require('../models/category.js')
    // const Category = CategoryModel(sequelize, Sequelize); 
    // const SubcategoryModel = require('../models/subcategory.js')
    // const Subcategory = SubcategoryModel(sequelize, Sequelize); 

    // console.log(Category);

    return queryInterface.bulkInsert('Themes', [
      {
        theme: 'Abuse and Violence',
        // categories: [{
        //   category: 'Abuse and Violence',
        //   subcategories: [{
        //     subcategory: 'Emotional abuse'
        //   }]
        // }]
      },
      {
        theme: 'Health'
      }
    ], {
      // include: [{
      //   association: Theme.Category,
      //   association: Category.Subcategory
      // }]
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Themes', null, {});
  }
};
