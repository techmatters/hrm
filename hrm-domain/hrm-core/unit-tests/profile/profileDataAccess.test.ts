import '../mockDb';
import QueryStream from 'pg-query-stream';
import { streamProfileForRenotifying } from '../../profile/profileDataAccess';

jest.mock('pg-query-stream', () => {
  return jest.fn().mockReturnValue({});
});

const MockQueryStream = QueryStream as any as jest.MockedFunction<any>;

describe('streamProfilesForRenotifying', () => {
  let lastQuerySql: string = '';
  beforeEach(() => {
    MockQueryStream.mockImplementation(sql => {
      lastQuerySql = sql;
      return {};
    });
  });

  test('No dates set - uses account, and min / max date placeholders in sql to create query stream', async () => {
    const promise = streamProfileForRenotifying({
      accountSid: 'AC4321',
      filters: { dateFrom: undefined, dateTo: undefined },
      batchSize: 1234,
    });
    console.debug('SQL Query:', lastQuerySql);
    expect(QueryStream).toHaveBeenCalledWith(expect.any(String), [], { batchSize: 1234 });
    expect(lastQuerySql).toContain('AC4321');
    expect(lastQuerySql).toContain("'-infinity'");
    expect(lastQuerySql).toContain("'infinity'");
    expect(promise).toBeTruthy();
  });
});
