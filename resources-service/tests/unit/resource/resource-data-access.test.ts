import * as pgPromise from 'pg-promise';
import { mockConnection, mockTask } from '../mock-db';
import * as resourceDb from '../../../src/resource/resource-data-access';

let conn: pgPromise.ITask<unknown>;

beforeEach(() => {
  conn = mockConnection();
});

describe('stub', () => {
  test('Runs SELECT 1 on DB', async () => {
    mockTask(conn);
    const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(1);

    const result = await resourceDb.stub();

    expect(oneSpy).toHaveBeenCalledWith('SELECT 1;');
    expect(result).toStrictEqual(1);
  });
});
