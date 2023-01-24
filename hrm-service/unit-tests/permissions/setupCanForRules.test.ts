/* eslint-disable jest/no-standalone-expect */
import each from 'jest-each';
import { setupCanForRules } from '../../src/permissions/setupCanForRules';
import { actionsMaps } from '../../src/permissions';
import { RulesFile } from '../../src/permissions/rulesMap';
import { workerSid, accountSid } from '../../service-tests/mocks';
import { user as newUser } from '@tech-matters/twilio-worker-auth';

const helpline = 'helpline';

const buildRules = (conditionsSets): RulesFile => {
  const entries = Object.values(actionsMaps)
    .flatMap(e => Object.values(e))
    .map(action => [action, conditionsSets]);
  return Object.fromEntries(entries);
};

describe('Test that all actions work fine (everyone)', () => {
  const rules = buildRules([['everyone']]);
  const can = setupCanForRules(rules);

  const notCreator = newUser('not creator', []);

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
  const rules = buildRules([]);
  const can = setupCanForRules(rules);

  const supervisor = newUser('creator', ['supervisor']);

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
  ).test('Action $action should return false', async ({ action, postSurveyObj, user }) => {
    expect(can(user, action, postSurveyObj)).toBeFalsy();
  });
});

/**
 * This test suite checks that [[]] (an empty list within the conditions sets for a given action)
 * does not result in granting permissions when it shouldn't.
 * The reason is how checkConditionsSet is implemented: [].every(predicate) evaluates true for all predicates
 */
describe('Test that an empty set of conditions does not grants permissions', () => {
  const rules = buildRules([[]]);
  const can = setupCanForRules(rules);

  const supervisor = newUser('creator', ['supervisor']);

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
  ).test('Action $action should return false', async ({ action, postSurveyObj, user }) => {
    expect(can(user, action, postSurveyObj)).toBeFalsy();
  });
});

const addPrettyConditionsSets = t => ({
  ...t,
  prettyConditionsSets: t.conditionsSets.map(arr => `[${arr.join(',')}]`),
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
        user: newUser('not creator', []),
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
        user: newUser('not creator', []),
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
        user: newUser('creator', ['supervisor']),
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
        user: newUser('not creator', ['supervisor']),
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
        user: newUser('not creator', ['supervisor']),
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
        user: newUser('not creator', []),
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
        user: newUser('creator', []),
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
        user: newUser('creator', []),
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
        user: newUser('not creator', []),
      },
    ].map(addPrettyConditionsSets),
    // .flatMap(mapTestToActions(actionsMaps.case)),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, caseObj, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

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
        user: newUser('not creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is owner',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: newUser('creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is supervisor',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: newUser('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedResult: true,
        expectedDescription: 'is supervisor',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: newUser('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isOwner']],
        expectedResult: true,
        expectedDescription: 'is owner',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: newUser('creator', []),
      },
      {
        conditionsSets: [['isOwner']],
        expectedResult: false,
        expectedDescription: 'is not owner',
        contactObj: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: newUser('not creator', []),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, contactObj, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

      Object.values(actionsMaps.contact).forEach(action =>
        test(`${action}`, async () => {
          expect(can(user, action, contactObj)).toBe(expectedResult);
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
        user: newUser('not creator', []),
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
        user: newUser('not creator', []),
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
        user: newUser('not creator', ['supervisor']),
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
        user: newUser('not creator', ['supervisor']),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, postSurveyObj, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

      Object.values(actionsMaps.postSurvey).forEach(action =>
        test(`${action}`, async () => {
          expect(can(user, action, postSurveyObj)).toBe(expectedResult);
        }),
      );
    },
  );
});
