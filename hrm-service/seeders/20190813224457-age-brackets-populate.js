module.exports = {
  up: queryInterface =>
    queryInterface.bulkInsert(
      'AgeBrackets',
      [
        {
          bracket: '0-3',
          min: 0,
          max: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '4-6',
          min: 4,
          max: 6,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '7-9',
          min: 7,
          max: 9,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '10-12',
          min: 10,
          max: 12,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '13-15',
          min: 13,
          max: 15,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '16-17',
          min: 16,
          max: 17,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '18-25',
          min: 18,
          max: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: '>25',
          min: 26,
          max: 120,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          bracket: 'Unknown',
          min: null,
          max: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {},
    ),

  down: queryInterface => queryInterface.bulkDelete('AgeBrackets', null, {}),
};
