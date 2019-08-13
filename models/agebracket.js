'use strict';
module.exports = (sequelize, DataTypes) => {
  const AgeBracket = sequelize.define('AgeBracket', {
    bracket: DataTypes.STRING,
    min: DataTypes.INTEGER,
    max: DataTypes.INTEGER
  }, {});
  AgeBracket.hasMany(Contact);
  return AgeBracket;
};