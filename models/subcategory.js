'use strict';
module.exports = (sequelize, DataTypes) => {
  const Subcategory = sequelize.define('Subcategory', {
    categoryId: DataTypes.INTEGER,
    subcategory: DataTypes.STRING
  }, {});
  Subcategory.belongsTo(Category);
  return Subcategory;
};