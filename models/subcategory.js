module.exports = (sequelize, DataTypes) => {
  const Subcategory = sequelize.define(
    'Subcategory',
    {
      subcategory: DataTypes.STRING,
    },
    {},
  );
  Subcategory.associate = () => {
    // associations can be defined here
  };
  return Subcategory;
};
