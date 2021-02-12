const { retrieveCategories, getPaginationElements } = require('../../controllers/helpers');

describe('test retrieveCategories', () => {
  test('undefined/null categories', async () => {
    expect(retrieveCategories(undefined)).toStrictEqual({});
    expect(retrieveCategories(null)).toStrictEqual({});
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

    expect(Object.keys(result)).toHaveLength(1);
    expect(result.category1).toHaveLength(1);
    expect(result.category1[0]).toBe('another1');
  });

  test('should return 2 categories', async () => {
    const categories = {
      category1: { something1: false, another1: true },
      category2: { something2: false, another2: false },
      category3: { something3: false, another3: false },
      category4: { something4: true, another4: false },
      category5: { something5: false, another5: false },
      category6: { something6: false, another6: false },
    };

    const result = retrieveCategories(categories);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result.category1).toHaveLength(1);
    expect(result.category1[0]).toBe('another1');
    expect(result.category4).toHaveLength(1);
    expect(result.category4[0]).toBe('something4');
  });

  test('should return 2 categories, 3 subs', async () => {
    const categories = {
      category1: { something1: false, another1: true },
      category2: { something2: false, another2: false },
      category3: { something3: false, another3: false },
      category4: { something4: true, another4: true },
      category5: { something5: false, another5: false },
      category6: { something6: false, another6: false },
    };

    const result = retrieveCategories(categories);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result.category1).toHaveLength(1);
    expect(result.category1[0]).toBe('another1');
    expect(result.category4).toHaveLength(2);
    expect(result.category4[0]).toBe('something4');
    expect(result.category4[1]).toBe('another4');
  });

  test('should return 3 categories', async () => {
    const categories = {
      category1: { something1: false, another1: true },
      category2: { something2: false, another2: false },
      category3: { something3: false, another3: false },
      category4: { something4: true, another4: false },
      category5: { something5: false, another5: false },
      category6: { something6: true, another6: false },
    };

    const result = retrieveCategories(categories);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result.category1).toHaveLength(1);
    expect(result.category1[0]).toBe('another1');
    expect(result.category4).toHaveLength(1);
    expect(result.category4[0]).toBe('something4');
    expect(result.category6).toHaveLength(1);
    expect(result.category6[0]).toBe('something6');
  });
});

describe('getPaginationElements()', () => {
  test('limit and offset', () => {
    const query = { limit: 10, offset: 20 };

    const { limit, offset } = getPaginationElements(query);

    expect(limit).toBe(10);
    expect(offset).toBe(20);
  });

  test('invalid limit', () => {
    const { limit: nonNumberLimit } = getPaginationElements({ limit: 'invalid' });
    const { limit: tooBigLimit } = getPaginationElements({ limit: 2000 });
    expect(nonNumberLimit).toBe(1000);
    expect(tooBigLimit).toBe(1000);
  });

  test('invalid offset', () => {
    const { offset: nonNumberOffset } = getPaginationElements({ offset: 'invalid' });
    expect(nonNumberOffset).toBe(0);
  });
});
