module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert(
      'Subcategories',
      [
        {
          // categoryId: 1, // NOTE: NOT ROBUST
          subcategory: 'Emotional abuse',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 1, // NOTE: NOT ROBUST
          subcategory: 'Gang violence',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 2, // NOTE: NOT ROBUST
          subcategory: 'Emotional Bullying',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 2, // NOTE: NOT ROBUST
          subcategory: 'Physical Bullying',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 3, // NOTE: NOT ROBUST
          subcategory: 'Alcohol addiction',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 3, // NOTE: NOT ROBUST
          subcategory: 'Alcohol experimentation',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 4, // NOTE: NOT ROBUST
          subcategory: 'Access to HIV/AIDS Medication and Healthcare',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          // categoryId: 4, // NOTE: NOT ROBUST
          subcategory: 'Child living with HIV/AIDS',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {},
    ),

  down: queryInterface => queryInterface.bulkDelete('Subcategories', null, {}),
};
