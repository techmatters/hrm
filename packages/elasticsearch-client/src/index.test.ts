import * as esClient from './index';

const exportedKeys = ['getClient', 'IndexTypes', 'ConfigIds'];

describe('Elasticsearch Client', () => {
  it('should return a client', () => {
    expect(esClient).toBeDefined();
    expect(Object.keys(esClient).length).toBe(exportedKeys.length);
  });
});
