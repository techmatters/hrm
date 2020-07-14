const { retrieveCategories } = require('../../controllers/helpers');

describe('test retrieveCategories', () => {
  test('undefined/null categories', async () => {
    expect(retrieveCategories(undefined)).toStrictEqual([]);
    expect(retrieveCategories(null)).toStrictEqual([]);
  });

  test('should return 1 category', async () => {
    const categories = {
      category1: { something1: false, another1: true },
      category2: { something2: false, another2: false },
      category3: { something3: false, another3: false },
      category4: { something4: false, another4: false },
      category5: { something5: false, another5: false },
      category6: { something6: false, another6: false },
    };

    const result = retrieveCategories(categories);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe('another1');
  });

  test('should return 2 category', async () => {
    const categories = {
      category1: { something1: false, another1: true },
      category2: { something2: false, another2: false },
      category3: { something3: false, another3: false },
      category4: { something4: true, another4: false },
      category5: { something5: false, another5: false },
      category6: { something6: false, another6: false },
    };

    const result = retrieveCategories(categories);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('another1');
    expect(result[1]).toBe('something4');
  });

  test('should return 3 category', async () => {
    const categories = {
      category1: { something1: false, another1: true },
      category2: { something2: false, another2: false },
      category3: { something3: false, another3: false },
      category4: { something4: true, another4: false },
      category5: { something5: true, another5: false },
      category6: { something6: false, another6: false },
    };

    const result = retrieveCategories(categories);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('another1');
    expect(result[1]).toBe('something4');
    expect(result[2]).toBe('something5');
  });

  test('test that Unspecified/Other category works as expected', async () => {
    const categories = {
      category1: { something1: false, another1: false, 'Unspecified/Other': true },
      category2: { something2: false, another2: false, 'Unspecified/Other': false },
    };

    const result = retrieveCategories(categories);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Unspecified/Other - category1');
  });
});
