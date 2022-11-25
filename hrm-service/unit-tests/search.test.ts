import { getPaginationElements } from '../src/search';

describe('getPaginationElements()', () => {
  test('limit and offset', () => {
    const query = { limit: '10', offset: '20' };

    const { limit, offset } = getPaginationElements(query);

    expect(limit).toBe(10);
    expect(offset).toBe(20);
  });

  test('invalid limit', () => {
    const { limit: nonNumberLimit } = getPaginationElements({ limit: 'invalid' });
    const { limit: tooBigLimit } = getPaginationElements({ limit: '2000' });
    expect(nonNumberLimit).toBe(1000);
    expect(tooBigLimit).toBe(1000);
  });

  test('invalid offset', () => {
    const { offset: nonNumberOffset } = getPaginationElements({ offset: 'invalid' });
    expect(nonNumberOffset).toBe(0);
  });
});
