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
    const oneOrNoneSpy = jest
      .spyOn(conn, 'oneOrNone')
      .mockResolvedValue({ name: 'Fake Resource', id: 'FAKE_RESOURCE' });

    const result = await resourceDb.getById('AC_FAKE', 'FAKE_RESOURCE');

    expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Resources'), {
      accountSid: 'AC_FAKE',
      resourceId: 'FAKE_RESOURCE',
    });
    expect(result).toStrictEqual({ name: 'Fake Resource', id: 'FAKE_RESOURCE' });
  });
});
