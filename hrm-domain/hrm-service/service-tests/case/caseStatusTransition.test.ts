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
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import { AccountSID } from '@tech-matters/types';
import * as mocks from '../mocks';
import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import { CaseService, getCase } from '@tech-matters/hrm-core/case/caseService';
import { db } from '@tech-matters/hrm-core/connection-pool';
import { isAfter, parseISO, subDays, subHours, subMinutes } from 'date-fns';
import { transitionCaseStatuses } from '@tech-matters/case-status-transition';
import { ALWAYS_CAN } from '../mocks';

const { case1, workerSid } = mocks;

const fixStatusUpdatedAt = async (caseObj: CaseService, statusUpdatedAt: Date) =>
  db.task(async t => {
    await t.none(
      `UPDATE "Cases" SET "statusUpdatedAt" = $<statusUpdatedAt> WHERE id = $<id> AND "accountSid" = $<accountSid>`,
      { statusUpdatedAt, id: caseObj.id, accountSid: caseObj.accountSid },
    );
  });

const getUpdatedCases = async (
  before: Record<string, CaseService>,
): Promise<Record<string, CaseService>> => {
  const updatedCaseEntries = await Promise.all(
    Object.entries(before).map(async ([key, caseObj]) => {
      return [key, await getCase(caseObj.id, caseObj.accountSid, ALWAYS_CAN)];
    }),
  );
  return Object.fromEntries(updatedCaseEntries);
};

describe('Single Rule', () => {
  const cases: Record<string, CaseService> = {};

  beforeAll(async () => {
    jest.setTimeout(20000);
    await mockingProxy.start(false);
    await mockSuccessfulTwilioAuthentication(workerSid);
    const mockttp = await mockingProxy.mockttpServer();
    const mockRuleSet: [AccountSID, Record<string, string>[]][] = [
      [
        'AC1',
        [
          {
            startingStatus: 'status1',
            targetStatus: 'status2',
            timeInStatusInterval: '1 day',
            description: 'test rule 1',
          },
        ],
      ],
    ];
    await mockSsmParameters(mockttp, [
      ...mockRuleSet.map(([accountSid, rules]) => ({
        name: `/test/xx-fake-1/hrm/scheduled-task/case-status-transition-rules/${accountSid}`,
        valueGenerator: () => JSON.stringify(rules),
      })),
      {
        name: `/test/xx-other-1/hrm/scheduled-task/case-status-transition-rules/AC1`,
        valueGenerator: () =>
          JSON.stringify([
            {
              startingStatus: 'not status1',
              targetStatus: 'not status2',
              timeInStatusInterval: '1 hour',
              description: 'test rule for wrong region - should not be applied',
            },
          ]),
      },
    ]);
  });

  afterAll(async () => {
    await mockingProxy.stop();
  });

  const validDateForTransition = subDays(new Date(), 2);
  const tooRecentDateForTransition = subHours(new Date(), 20);

  beforeEach(async () => {
    cases.validForUpdate = await caseApi.createCase(
      { ...case1, status: 'status1' },
      'AC1',
      workerSid,
      undefined,
      true,
    );
    cases.validStatusButTooRecent = await caseApi.createCase(
      { ...case1, status: 'status1' },
      'AC1',
      workerSid,
      undefined,
      true,
    );
    cases.validUpdatedTimeButIncorrectStatus = await caseApi.createCase(
      { ...case1, status: 'not status1' },
      'AC1',
      workerSid,
      undefined,
      true,
    );
    cases.validForUpdateButWrongAccount = await caseApi.createCase(
      { ...case1, status: 'status1' },
      'ACnot1',
      workerSid,
      undefined,
      true,
    );
    await Promise.all([
      fixStatusUpdatedAt(cases.validStatusButTooRecent, tooRecentDateForTransition),
      fixStatusUpdatedAt(
        cases.validUpdatedTimeButIncorrectStatus,
        validDateForTransition,
      ),
      fixStatusUpdatedAt(cases.validForUpdate, validDateForTransition),
      fixStatusUpdatedAt(cases.validForUpdateButWrongAccount, validDateForTransition),
    ]);
  });
  test('Should update status for qualifying cases only', async () => {
    await transitionCaseStatuses();
    const {
      validForUpdate,
      validStatusButTooRecent,
      validForUpdateButWrongAccount,
      validUpdatedTimeButIncorrectStatus,
    } = await getUpdatedCases(cases);
    expect(validForUpdate.status).toEqual('status2');
    expect(
      isAfter(parseISO(validForUpdate.statusUpdatedAt), subMinutes(new Date(), 5)),
    ).toBeTruthy();
    expect(validForUpdate.statusUpdatedBy).toBe('test rule 1');
    expect(validStatusButTooRecent.status).toEqual('status1');
    expect(validStatusButTooRecent.statusUpdatedAt).toParseAsDate(
      tooRecentDateForTransition,
    );
    expect(validStatusButTooRecent.statusUpdatedBy).toBeNull();
    expect(validUpdatedTimeButIncorrectStatus.status).toEqual('not status1');
    expect(validUpdatedTimeButIncorrectStatus.statusUpdatedAt).toParseAsDate(
      validDateForTransition,
    );
    expect(validUpdatedTimeButIncorrectStatus.statusUpdatedBy).toBeNull();
    expect(validForUpdateButWrongAccount.status).toEqual('status1');
    expect(validForUpdateButWrongAccount.statusUpdatedAt).toParseAsDate(
      validDateForTransition,
    );
    expect(validForUpdateButWrongAccount.statusUpdatedBy).toBeNull();
  });
});
