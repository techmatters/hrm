import * as pgPromise from 'pg-promise';
import { mockConnection, mockTask } from '../mock-db';
import * as resourceDb from '../../../src/resource/resource-data-access';

let conn: pgPromise.ITask<unknown>;

beforeEach(() => {
  conn = mockConnection();
});

describe('getById', () => {
  test('Runs a SELECT against the Resources table on the DB', async () => {
    mockTask(conn);
    const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(1);

    const result = await resourceDb.getById();

    expect(oneSpy).toHaveBeenCalledWith('SELECT 1;');
    expect(result).toStrictEqual(1);
  });
});
