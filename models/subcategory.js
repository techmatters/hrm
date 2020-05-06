module.exports = (sequelize, DataTypes) => {
  const Subcategory = sequelize.define('Subcategory', {
    subcategory: DataTypes.STRING,
  });

  return Subcategory;
};
