'use strict';
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    themeId: DataTypes.INTEGER,
    category: DataTypes.STRING
  }, {});
  Category.belongsTo(Theme);
  Category.hasMany(Subcategory);
  return Category;
};