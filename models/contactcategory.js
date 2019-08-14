'use strict';
module.exports = (sequelize, DataTypes) => {
  const ContactCategory = sequelize.define('ContactCategory', {
    contactId: DataTypes.INTEGER,
    themeId: DataTypes.INTEGER,
    categoryId: DataTypes.INTEGER,
    subcategoryId: DataTypes.INTEGER,
    isPrimary: DataTypes.BOOLEAN
  }, {});
  ContactCategory.belongsTo(Contact);
  ContactCategory.hasOne(Theme);
  ContactCategory.hasOne(Category);
  ContactCategory.hasOne(Subcategory);
  return ContactCategory;
};