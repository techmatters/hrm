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

/* eslint-disable jest/no-standalone-expect */
import each from 'jest-each';
import { initializeCanForRules } from '../../permissions/initializeCanForRules';
import { actionsMaps } from '../../permissions';
import { RulesFile } from '../../permissions/rulesMap';
import { workerSid, accountSid } from '../mocks';
import { twilioUser } from '@tech-matters/twilio-worker-auth';
import { TargetKind } from '../../permissions/actions';
import { subDays, subHours } from 'date-fns';

const helpline = 'helpline';

const buildRules = (
  partialRules: {
    [K in TargetKind]?: string[][];
  } & { default?: string[][] },
): RulesFile => {
  const entries = Object.entries(actionsMaps)
    .flatMap(([tk, obj]) => Object.values(obj).map(action => [tk, action]))
    .map(([tk, action]) => {
      return [action, partialRules[tk] || partialRules.default || []];
    });

  return Object.fromEntries(entries);
};

describe('Test that all actions work fine (everyone)', () => {
  const rules = buildRules({ default: [['everyone']] });
  const can = initializeCanForRules(rules);

  const notCreator = twilioUser('not creator', []);

  // Test Case permissions
  each(
    Object.values(actionsMaps.case).map(action => ({
      action,
      caseObj: {
        status: 'open',
        info: {},
        twilioWorkerId: 'creator',
        helpline,
        createdBy: workerSid,
        accountSid,
      },
      user: notCreator,
    })),
  ).test('Action $action should return true', async ({ action, caseObj, user }) => {
    expect(can(user, action, caseObj)).toBeTruthy();
  });

  // Test Contact permissions
  each(
    Object.values(actionsMaps.contact).map(action => ({
      action,
      contactObj: {
        accountSid,
        twilioWorkerId: 'creator',
      },
      user: notCreator,
    })),
  ).test('Action $action should return true', async ({ action, contactObj, user }) => {
    expect(can(user, action, contactObj)).toBeTruthy();
  });

  // Test PostSurvey permissions
  each(
    Object.values(actionsMaps.postSurvey).map(action => ({
      action,
      postSurveyObj: {
        accountSid,
        taskId: 'task-sid',
        contactTaskId: 'contact-task-id',
        data: {},
      },
      user: notCreator,
    })),
  ).test('Action $action should return true', async ({ action, postSurveyObj, user }) => {
    expect(can(user, action, postSurveyObj)).toBeTruthy();
  });
});

describe('Test that all actions work fine (no one)', () => {
  const rules = buildRules({ default: [] });
  const can = initializeCanForRules(rules);

  const supervisor = twilioUser('creator', ['supervisor']);

  // Test Case permissions
  each(
    Object.values(actionsMaps.case).map(action => ({
      action,
      caseObj: {
        status: 'open',
        info: {},
        twilioWorkerId: 'creator',
        helpline,
        createdBy: workerSid,
        accountSid,
      },
      user: supervisor,
    })),
  ).test('Action $action should return false', async ({ action, caseObj, user }) => {
    expect(can(user, action, caseObj)).toBeFalsy();
  });

  // Test Contact permissions
  each(
    Object.values(actionsMaps.contact).map(action => ({
      action,
      contactObj: {
        accountSid,
        twilioWorkerId: 'creator',
      },
      user: supervisor,
    })),
  ).test('Action $action should return true', async ({ action, contactObj, user }) => {
    expect(can(user, action, contactObj)).toBeFalsy();
  });

  // Test PostSurvey permissions
  each(
    Object.values(actionsMaps.postSurvey).map(action => ({
      action,
      postSurveyObj: {
        accountSid,
        taskId: 'task-sid',
        contactTaskId: 'contact-task-id',
        data: {},
      },
      user: supervisor,
    })),
  ).test(
    'Action $action should return false',
    async ({ action, postSurveyObj, user }) => {
      expect(can(user, action, postSurveyObj)).toBeFalsy();
    },
  );
});

/**
 * This test suite checks that [[]] (an empty list within the conditions sets for a given action)
 * does not result in granting permissions when it shouldn't.
 * The reason is how checkConditionsSet is implemented: [].every(predicate) evaluates true for all predicates
 */
describe('Test that an empty set of conditions does not grants permissions', () => {
  const rules = buildRules({ default: [[]] });
  const can = initializeCanForRules(rules);

  const supervisor = twilioUser('creator', ['supervisor']);

  // Test Case permissions
  each(
    Object.values(actionsMaps.case).map(action => ({
      action,
      caseObj: {
        status: 'open',
        info: {},
        twilioWorkerId: 'creator',
        helpline,
        createdBy: workerSid,
        accountSid,
      },
      user: supervisor,
    })),
  ).test('Action $action should return false', async ({ action, caseObj, user }) => {
    expect(can(user, action, caseObj)).toBeFalsy();
  });

  // Test Contact permissions
  each(
    Object.values(actionsMaps.contact).map(action => ({
      action,
      contactObj: {
        accountSid,
        twilioWorkerId: 'creator',
      },
      user: supervisor,
    })),
  ).test('Action $action should return true', async ({ action, contactObj, user }) => {
    expect(can(user, action, contactObj)).toBeFalsy();
  });

  // Test PostSurvey permissions
  each(
    Object.values(actionsMaps.postSurvey).map(action => ({
      action,
      postSurveyObj: {
        accountSid,
        taskId: 'task-sid',
        contactTaskId: 'contact-task-id',
        data: {},
      },
      user: supervisor,
    })),
  ).test(
    'Action $action should return false',
    async ({ action, postSurveyObj, user }) => {
      expect(can(user, action, postSurveyObj)).toBeFalsy();
    },
  );
});

const addPrettyConditionsSets = t => ({
  ...t,
  prettyConditionsSets: t.conditionsSets.map(
    cs => `[${cs.map(c => (typeof c === 'object' ? JSON.stringify(c) : c)).join(',')}]`,
  ),
});

// Test Case permissions
describe('Test different scenarios (Case)', () => {
  each(
    [
      {
        conditionsSets: [['everyone']],
        expectedResult: true,
        expectedDescription: 'is not creator nor supervisor, case is open',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [['everyone']],
        expectedResult: true,
        expectedDescription: 'is not creator nor supervisor, case is closed',
        caseObj: {
          status: 'closed',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [], // no one
        expectedResult: false,
        expectedDescription: 'user is creator, supervisor, case is open',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: true,
        expectedDescription: 'user is supervisor but not creator, case open',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: true,
        expectedDescription: 'user is supervisor but not creator, case closed',
        caseObj: {
          status: 'closed',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: false,
        expectedDescription: 'user is not supervisor nor creator',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: true,
        expectedDescription: 'user is creator and case is open',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('creator', []),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: false,
        expectedDescription: 'user is creator but case is closed',
        caseObj: {
          status: 'closed',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('creator', []),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: false,
        expectedDescription: 'case is open but user is not creator',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdHoursAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdHoursAgo within the provided range',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdHoursAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdHoursAgo outside the provided range',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdDaysAgo within the provided range',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdDaysAgo outside the provided range',
        caseObj: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
    ].map(addPrettyConditionsSets),
    // .flatMap(mapTestToActions(actionsMaps.case)),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, caseObj, user, expectedResult }) => {
      const rules = buildRules({ case: conditionsSets });
      const can = initializeCanForRules(rules);

      Object.values(actionsMaps.case).forEach(action =>
        test(`${action}`, async () => {
          expect(can(user, action, caseObj)).toBe(expectedResult);
        }),
      );
    },
  );
});

// Test Contact permissions
describe('Test different scenarios (Contact)', () => {
  each(
    [
      {
        conditionsSets: [['everyone']],
        expectedResult: true,
        expectedDescription: 'not supervisor',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is owner',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: twilioUser('creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is supervisor',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: twilioUser('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedResult: true,
        expectedDescription: 'is supervisor',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: twilioUser('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isOwner']],
        expectedResult: true,
        expectedDescription: 'is owner',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: twilioUser('creator', []),
      },
      {
        conditionsSets: [['isOwner']],
        expectedResult: false,
        expectedDescription: 'is not owner',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdHoursAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdHoursAgo within the provided range',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdHoursAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdHoursAgo outside the provided range',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdDaysAgo within the provided range',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdDaysAgo outside the provided range',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not creator', []),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, contactObj, user, expectedResult }) => {
      const rules = buildRules({ contact: conditionsSets });
      const can = initializeCanForRules(rules);

      Object.values(actionsMaps.contact).forEach(action =>
        test(`${action}`, async () => {
          expect(can(user, action, contactObj)).toBe(expectedResult);
        }),
      );
    },
  );
});

// Test Profile permissions
describe('Test different scenarios (Profile)', () => {
  each(
    [
      {
        conditionsSets: [['everyone']],
        expectedDescription: 'not supervisor',
        profileObj: {
          accountSid,
        },
        user: twilioUser('not supervisor', []),
        expectedResult: true,
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedDescription: 'not supervisor',
        profileObj: {
          accountSid,
        },
        user: twilioUser('not supervisor', []),
        expectedResult: false,
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedDescription: 'is supervisor',
        profileObj: {
          accountSid,
        },
        user: twilioUser('supervisor', ['supervisor']),
        expectedResult: true,
      },
      {
        conditionsSets: [[{ createdHoursAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdHoursAgo within the provided range',
        profileObj: {
          accountSid,
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ createdHoursAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdHoursAgo outside the provided range',
        profileObj: {
          accountSid,
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdDaysAgo within the provided range',
        profileObj: {
          accountSid,
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdDaysAgo outside the provided range',
        profileObj: {
          accountSid,
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, profileObj, user, expectedResult }) => {
      const rules = buildRules({ profile: conditionsSets });
      const can = initializeCanForRules(rules);

      Object.values(actionsMaps.profile).forEach(action =>
        test(`${action}`, async () => {
          expect(can(user, action, profileObj)).toBe(expectedResult);
        }),
      );
    },
  );
});

// Test ProfileSection permissions
describe('Test different scenarios (ProfileSection)', () => {
  each(
    [
      {
        conditionsSets: [['everyone']],
        expectedDescription: 'not supervisor',
        profileSectionObj: {
          accountSid,
        },
        user: twilioUser('not supervisor', []),
        expectedResult: true,
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedDescription: 'not supervisor',
        profileSectionObj: {
          accountSid,
        },
        user: twilioUser('not supervisor', []),
        expectedResult: false,
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedDescription: 'is supervisor',
        profileSectionObj: {
          accountSid,
        },
        user: twilioUser('supervisor', ['supervisor']),
        expectedResult: true,
      },
      {
        conditionsSets: [[{ createdHoursAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdHoursAgo within the provided range',
        profileSectionObj: {
          accountSid,
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ createdHoursAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdHoursAgo outside the provided range',
        profileSectionObj: {
          accountSid,
          createdAt: subHours(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 2 }]],
        expectedResult: true,
        expectedDescription: 'createdDaysAgo within the provided range',
        profileSectionObj: {
          accountSid,
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ createdDaysAgo: 1 }]],
        expectedResult: false,
        expectedDescription: 'createdDaysAgo outside the provided range',
        profileSectionObj: {
          accountSid,
          createdAt: subDays(Date.now(), 1).toISOString(),
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ sectionType: 'summary' }]],
        expectedResult: true,
        expectedDescription: 'sectionType is summary',
        profileSectionObj: {
          accountSid,
          sectionType: 'summary',
        },
        user: twilioUser('not supervisor', []),
      },
      {
        conditionsSets: [[{ sectionType: 'other' }]],
        expectedResult: false,
        expectedDescription: 'sectionType is summary',
        profileSectionObj: {
          accountSid,
          sectionType: 'summary',
        },
        user: twilioUser('not supervisor', []),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, profileSectionObj, user, expectedResult }) => {
      const rules = buildRules({ profileSection: conditionsSets });
      const can = initializeCanForRules(rules);

      Object.values(actionsMaps.profileSection).forEach(action =>
        test(`${action}`, async () => {
          expect(can(user, action, profileSectionObj)).toBe(expectedResult);
        }),
      );
    },
  );
});

// Test PostSurvey permissions
describe('Test different scenarios (PostSurvey)', () => {
  each(
    [
      {
        conditionsSets: [['everyone']],
        expectedResult: true,
        expectedDescription: 'not supervisor',
        postSurveyObj: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'not supervisor',
        postSurveyObj: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: twilioUser('not creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is supervisor',
        postSurveyObj: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: twilioUser('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedResult: true,
        expectedDescription: 'is supervisor',
        postSurveyObj: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: twilioUser('not creator', ['supervisor']),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, postSurveyObj, user, expectedResult }) => {
      const rules = buildRules({ postSurvey: conditionsSets });
      const can = initializeCanForRules(rules);

      Object.values(actionsMaps.postSurvey).forEach(action =>
        test(`${action}`, async () => {
          expect(can(user, action, postSurveyObj)).toBe(expectedResult);
        }),
      );
    },
  );
});
