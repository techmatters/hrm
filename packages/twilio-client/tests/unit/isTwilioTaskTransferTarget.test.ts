/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import {
  getClient,
  isTwilioTaskTransferTarget,
  setMockTaskRouterWorkspaces,
} from '../../index';

const generateWorkspaceMocks = (
  workspacesTasks: {
    taskSid: string;
    originalTaskSid?: string;
    workerWithReservation?: string;
  }[][],
) => {
  return workspacesTasks.map((tasks, idx) => ({
    tasks: () => ({
      get: (taskSid: string) => {
        const task = tasks.find(t => t.taskSid === taskSid);
        if (task) {
          return {
            fetch: () =>
              Promise.resolve({
                attributes: JSON.stringify(
                  task.originalTaskSid
                    ? { transferMeta: { originalTask: task.originalTaskSid } }
                    : {},
                ),
                reservations: () => ({
                  list: () =>
                    Promise.resolve(
                      task.workerWithReservation
                        ? [{ workerSid: task.workerWithReservation }]
                        : [],
                    ),
                }),
              }),
          };
        }
      },
    }),
    sid: `workspace-sid-${idx}`,
  }));
};

describe('isTwilioTaskTargetTransfer', () => {
  let client: Awaited<ReturnType<typeof getClient>>;

  beforeAll(async () => {
    client = await getClient({
      accountSid: 'ACx',
      authToken: 'mockAuthToken',
    });
  });

  beforeEach(() => {
    setMockTaskRouterWorkspaces(
      generateWorkspaceMocks([
        [
          {
            taskSid: 'WT-other',
            originalTaskSid: 'WTy',
          },

          {
            taskSid: 'WT-no-reservations',
            originalTaskSid: 'WT-original',
          },
        ],
        [],
        [
          {
            taskSid: 'WT-no-transfer',
            workerWithReservation: 'WKx',
          },
          {
            taskSid: 'WT-transfer-and-reservation',
            originalTaskSid: 'WT-original',
            workerWithReservation: 'WKx',
          },
          {
            taskSid: 'WT-other-2',
            originalTaskSid: 'WT-original',
            workerWithReservation: 'WKx',
          },
        ],
      ]),
    );
  });
  afterEach(() => {
    setMockTaskRouterWorkspaces([]);
  });

  test('Returns true if the workers is reserved for the task, the task Id matches the specified target task Id, and the originalTask matches the specified existing Id', async () => {
    const res = await isTwilioTaskTransferTarget(
      client,
      'WT-transfer-and-reservation',
      'WT-original',
      'WKx',
    );
    expect(res).toBe(true);
  });

  test("Returns false if the workers is reserved for the task, the task Id matches the specified target task Id, and the originalTask doesn't the specified existing Id", async () => {
    const res = await isTwilioTaskTransferTarget(
      client,
      'WT-transfer-and-reservation',
      'WT-unoriginal',
      'WKx',
    );
    expect(res).toBe(false);
  });

  test("Returns false if the workers is reserved for the task, the task Id matches the specified target task Id, but the taslk isn't a transfer", async () => {
    const res = await isTwilioTaskTransferTarget(
      client,
      'WT-no-transfer',
      'WT-unoriginal',
      'WKx',
    );
    expect(res).toBe(false);
  });

  test("Returns false if the task Id matches the specified target task Id, and the originalTask match the specified existing Id, but the worker doesn't have a reservation", async () => {
    const res = await isTwilioTaskTransferTarget(
      client,
      'WT-no-reservation',
      'WT-original',
      'WKx',
    );
    expect(res).toBe(false);
  });

  test('Returns false if the task Id matches the specified target task Id, and the originalTask match the specified existing Id, but a different worker has a reservation', async () => {
    const res = await isTwilioTaskTransferTarget(
      client,
      'WT-transfer-and-reservation',
      'WT-original',
      'WK-other',
    );
    expect(res).toBe(false);
  });

  test("Returns false if the task isn't found in any workspace", async () => {
    const res = await isTwilioTaskTransferTarget(
      client,
      'WT-not-here',
      'WT-original',
      'WKx',
    );
    expect(res).toBe(false);
  });
});
