'use strict';
module.exports = (sequelize, DataTypes) => {
  const Theme = sequelize.define('Theme', {
    theme: DataTypes.STRING
  }, {});
  Theme.hasMany(Category);
  return Theme;
};