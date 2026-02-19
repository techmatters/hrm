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

import * as caseDb from '../../case/caseDataAccess';
import * as caseApi from '../../case/caseService';
import * as caseSectionApi from '../../case/caseSection/caseSectionService';
import { createMockCase, createMockCaseRecord } from './mockCases';
import each from 'jest-each';
import { CaseRecord, NewCaseRecord } from '../../case/caseDataAccess';
import '@tech-matters/testing/expectToParseAsDate';
import { workerSid, accountSid } from '../mocks';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import { rulesMap } from '../../permissions';
import { RulesFile } from '../../permissions/rulesMap';
import * as entityChangeNotify from '../../notifications/entityChangeNotify';

const publishCaseChangeNotificationSpy = jest
  .spyOn(entityChangeNotify, 'publishCaseChangeNotification')
  .mockImplementation(() => Promise.resolve('Ok') as any);

jest.mock('../../case/caseDataAccess');
const twilioWorkerId = 'WK-twilio-worker-id';

test('create case', async () => {
  const caseToBeCreated = createMockCase({
    helpline: 'helpline',
    status: 'open',
    twilioWorkerId: 'WK-client-assigned-twilio-worker-id',
    createdBy: 'WK Fake news', // Overwritten by workerSid for User
    accountSid: 'AC-wrong-account-sid', // Overwritten by accountSid for User
    info: {},
  });
  const expectedCaseDbParameter: NewCaseRecord = {
    ...caseToBeCreated,
    accountSid,
    createdBy: workerSid,
    createdAt: expect.any(String), // current timestamp
    updatedAt: expect.any(String), // current timestamp
    info: {},
  };
  // @ts-ignore
  delete expectedCaseDbParameter.id;
  const createdCaseRecord: CaseRecord = {
    ...expectedCaseDbParameter,
    id: 1,
    accountSid,
  };
  const createSpy = jest.spyOn(caseDb, 'create').mockResolvedValue(createdCaseRecord);
  // const getByIdSpy =
  jest.spyOn(caseDb, 'getById').mockResolvedValueOnce(createdCaseRecord);
  jest
    .spyOn(caseSectionApi, 'getMultipleCaseTimelines')
    .mockResolvedValue({ count: 0, timelines: {} });

  const createdCase = await caseApi.createCase(caseToBeCreated, accountSid, workerSid);
  // any worker & account specified on the object should be overwritten with the ones from the user
  expect(createSpy).toHaveBeenCalledWith(expectedCaseDbParameter);
  expect(createdCase).toStrictEqual({
    ...caseToBeCreated,
    id: '1',
    createdBy: workerSid,
    accountSid,
    precalculatedPermissions: {
      userOwnsContact: false,
    },
  });

  await new Promise(process.nextTick);
  expect(publishCaseChangeNotificationSpy).toHaveBeenCalled();
});

describe('searchCases', () => {
  const caseId = 1;
  const caseObject = createMockCase({
    id: caseId.toString(),
    helpline: 'helpline',
    accountSid,
    status: 'open',
    info: {},
    twilioWorkerId,
  });

  const caseRecord = createMockCaseRecord({
    accountSid,
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: {},
    twilioWorkerId,
  });

  each([
    {
      description: 'list cases (without contacts) - creates empty categories',
      filterParameters: { helpline: 'helpline' },
      expectedDbFilters: { helplines: ['helpline'] },
      casesFromDb: [caseRecord],
      expectedCases: [
        {
          ...caseObject,
          precalculatedPermissions: {
            userOwnsContact: false,
          },
        },
      ],
    },
    {
      description:
        'list cases without helpline - sends offset & limit to db layer but no helpline',
      listConfig: { offset: 30, limit: 45 },
      casesFromDb: [caseRecord],
      expectedCases: [
        {
          ...caseObject,
          precalculatedPermissions: {
            userOwnsContact: false,
          },
        },
      ],
    },
  ]).test(
    '$description',
    async ({
      casesFromDb,
      expectedCases,
      listConfig = {},
      search = {},
      filterParameters = {},
      expectedDbSearchCriteria = {},
      expectedDbFilters = {},
    }) => {
      const expected = { cases: expectedCases, count: 1337 };

      const searchSpy = jest
        .spyOn(caseDb, 'list')
        .mockResolvedValue({ cases: casesFromDb, count: 1337 });

      const result = await caseApi.listCases(
        accountSid,
        listConfig,
        search,
        filterParameters,
        // {closedCases, counselor, filters: {}, helpline},
        {
          can: () => true,
          user: newTwilioUser(accountSid, workerSid, []),
          permissionRules: rulesMap.open,
        },
      );

      const user = { ...newTwilioUser(accountSid, workerSid, []), isSupervisor: false };
      expect(searchSpy).toHaveBeenCalledWith(
        user,
        [['everyone']],
        listConfig ?? {},
        accountSid,
        expectedDbSearchCriteria,
        {
          includeOrphans: true,
          excludedStatuses: [],
          counsellors: undefined,
          ...expectedDbFilters,
        },
      );
      expect(result).toStrictEqual(expected);

      searchSpy.mockReset();
    },
  );
});

describe('search cases permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  each([
    {
      description: 'Supervisor can view others cases',
      isSupervisor: true,
      canOnlyViewOwnCases: false,
      counsellors: ['any-worker-sid'],
    },
    {
      description: 'Agent can view others cases',
      isSupervisor: false,
      canOnlyViewOwnCases: false,
      counsellors: ['any-worker-sid'],
    },
    {
      description: 'Agent cannot view others cases',
      isSupervisor: false,
      canOnlyViewOwnCases: true,
      counsellors: ['any-worker-sid'],
    },
    {
      description: 'Agent can view own cases',
      isSupervisor: false,
      canOnlyViewOwnCases: true,
      counsellors: workerSid,
      overriddenCounsellors: [workerSid],
    },
    {
      description: 'Agent defaults to own cases when no counselor specified',
      isSupervisor: false,
      canOnlyViewOwnCases: true,
      counsellors: undefined,
    },
  ]).test('$description', async ({ isSupervisor, canOnlyViewOwnCases, counsellors }) => {
    const filterParameters = {
      helpline: 'helpline',
      closedCases: true,
      filters: {
        counsellors,
      },
    };
    const viewOwnCasesRulesFile: RulesFile = {
      ...rulesMap.open,
      ['viewCase']: [['isCreator']],
    };
    const limitOffset = { limit: '10', offset: '0' };
    const can = () => true;
    const roles = [];
    const user = {
      ...newTwilioUser(accountSid, workerSid, roles),
      isSupervisor: isSupervisor,
    };
    const reqData = {
      can,
      user,
      permissionRules: canOnlyViewOwnCases ? viewOwnCasesRulesFile : rulesMap.open,
    };

    const searchSpy = jest
      .spyOn(caseDb, 'list')
      .mockResolvedValue({ cases: [], count: 0 });
    await caseApi.listCases(accountSid, limitOffset, null, filterParameters, reqData);

    expect(searchSpy).toHaveBeenCalledWith(
      user,
      canOnlyViewOwnCases ? [['isCreator']] : [['everyone']],
      limitOffset,
      accountSid,
      null,
      filterParameters.filters,
    );
  });
});
