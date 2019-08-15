'use strict';
module.exports = (sequelize, DataTypes) => {
  const AgeBracket = sequelize.define('AgeBracket', {
    bracket: DataTypes.STRING,
    min: DataTypes.INTEGER,
    max: DataTypes.INTEGER
  }, {});
  AgeBracket.associate = function(models) {
    // associations can be defined here
  };
  return AgeBracket;
};