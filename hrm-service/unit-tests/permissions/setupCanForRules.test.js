/* eslint-disable jest/no-standalone-expect */
const each = require('jest-each').default;

const models = require('../../src/models');

jest.mock('../../src/models');

const { setupCanForRules } = require('../../src/permissions/setupCanForRules');
const { actionsMaps } = require('../../src/permissions/actions');
import { User } from '../../src/permissions';

const { Case, PostSurvey, Contact } = models;

const accountSid = 'account-sid';
const helpline = 'helpline';
const workerSid = 'worker-sid';

const buildRules = conditionsSets =>
  Object.values(actionsMaps)
    .flatMap(e => Object.values(e))
    .reduce((accum, action) => ({ ...accum, [action]: conditionsSets }), {});

describe('Test that all actions work fine (everyone)', () => {
  const rules = buildRules([['everyone']]);
  const can = setupCanForRules(rules);

  const notCreator = new User('not creator', []);

  // Test Case permissions
  each(
    Object.values(actionsMaps.case).map(action => ({
      action,
      caseToBeCreated: {
        status: 'open',
        info: {},
        twilioWorkerId: 'creator',
        helpline,
        createdBy: workerSid,
        accountSid,
      },
      user: notCreator,
    })),
  ).test('Action $action should return true', async ({ action, caseToBeCreated, user }) => {
    const createdCase = new Case();
    createdCase.dataValues = caseToBeCreated;
    expect(can(user, action, createdCase)).toBeTruthy();
  });

  // Test Contact permissions
  each(
    Object.values(actionsMaps.contact).map(action => ({
      action,
      contactToBeCreated: {
        accountSid,
        twilioWorkerId: 'creator',
      },
      user: notCreator,
    })),
  ).test('Action $action should return true', async ({ action, contactToBeCreated, user }) => {
    const createdContact = new Contact();
    createdContact.dataValues = contactToBeCreated;
    expect(can(user, action, createdContact)).toBeTruthy();
  });

  // Test PostSurvey permissions
  each(
    Object.values(actionsMaps.postSurvey).map(action => ({
      action,
      postSurveyToBeCreated: {
        accountSid,
        taskId: 'task-sid',
        contactTaskId: 'contact-task-id',
        data: {},
      },
      user: notCreator,
    })),
  ).test('Action $action should return true', async ({ action, postSurveyToBeCreated, user }) => {
    const createdPostSurvey = new PostSurvey();
    createdPostSurvey.dataValues = postSurveyToBeCreated;
    expect(can(user, action, createdPostSurvey)).toBeTruthy();
  });
});

describe('Test that all actions work fine (no one)', () => {
  const rules = buildRules([]);
  const can = setupCanForRules(rules);

  const supervisor = new User('creator', ['supervisor']);

  // Test Case permissions
  each(
    Object.values(actionsMaps.case).map(action => ({
      action,
      caseToBeCreated: {
        status: 'open',
        info: {},
        twilioWorkerId: 'creator',
        helpline,
        createdBy: workerSid,
        accountSid,
      },
      user: supervisor,
    })),
  ).test('Action $action should return false', async ({ action, caseToBeCreated, user }) => {
    const createdCase = new Case();
    createdCase.dataValues = caseToBeCreated;
    expect(can(user, action, createdCase)).toBeFalsy();
  });

  // Test Contact permissions
  each(
    Object.values(actionsMaps.contact).map(action => ({
      action,
      contactToBeCreated: {
        accountSid,
        twilioWorkerId: 'creator',
      },
      user: supervisor,
    })),
  ).test('Action $action should return true', async ({ action, contactToBeCreated, user }) => {
    const createdContact = new Contact();
    createdContact.dataValues = contactToBeCreated;
    expect(can(user, action, createdContact)).toBeFalsy();
  });

  // Test PostSurvey permissions
  each(
    Object.values(actionsMaps.postSurvey).map(action => ({
      action,
      postSurveyToBeCreated: {
        accountSid,
        taskId: 'task-sid',
        contactTaskId: 'contact-task-id',
        data: {},
      },
      user: supervisor,
    })),
  ).test('Action $action should return false', async ({ action, postSurveyToBeCreated, user }) => {
    const createdPostSurvey = new PostSurvey();
    createdPostSurvey.dataValues = postSurveyToBeCreated;
    expect(can(user, action, createdPostSurvey)).toBeFalsy();
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

  const supervisor = new User('creator', ['supervisor']);

  // Test Case permissions
  each(
    Object.values(actionsMaps.case).map(action => ({
      action,
      caseToBeCreated: {
        status: 'open',
        info: {},
        twilioWorkerId: 'creator',
        helpline,
        createdBy: workerSid,
        accountSid,
      },
      user: supervisor,
    })),
  ).test('Action $action should return false', async ({ action, caseToBeCreated, user }) => {
    const createdCase = new Case();
    createdCase.dataValues = caseToBeCreated;
    expect(can(user, action, createdCase)).toBeFalsy();
  });

  // Test Contact permissions
  each(
    Object.values(actionsMaps.contact).map(action => ({
      action,
      contactToBeCreated: {
        accountSid,
        twilioWorkerId: 'creator',
      },
      user: supervisor,
    })),
  ).test('Action $action should return true', async ({ action, contactToBeCreated, user }) => {
    const createdContact = new Contact();
    createdContact.dataValues = contactToBeCreated;
    expect(can(user, action, createdContact)).toBeFalsy();
  });

  // Test PostSurvey permissions
  each(
    Object.values(actionsMaps.postSurvey).map(action => ({
      action,
      postSurveyToBeCreated: {
        accountSid,
        taskId: 'task-sid',
        contactTaskId: 'contact-task-id',
        data: {},
      },
      user: supervisor,
    })),
  ).test('Action $action should return false', async ({ action, postSurveyToBeCreated, user }) => {
    const createdPostSurvey = new PostSurvey();
    createdPostSurvey.dataValues = postSurveyToBeCreated;
    expect(can(user, action, createdPostSurvey)).toBeFalsy();
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
        caseToBeCreated: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('not creator', []),
      },
      {
        conditionsSets: [['everyone']],
        expectedResult: true,
        expectedDescription: 'is not creator nor supervisor, case is closed',
        caseToBeCreated: {
          status: 'closed',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('not creator', []),
      },
      {
        conditionsSets: [], // no one
        expectedResult: false,
        expectedDescription: 'user is creator, supervisor, case is open',
        caseToBeCreated: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: true,
        expectedDescription: 'user is supervisor but not creator, case open',
        caseToBeCreated: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: true,
        expectedDescription: 'user is supervisor but not creator, case closed',
        caseToBeCreated: {
          status: 'closed',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: false,
        expectedDescription: 'user is not supervisor nor creator',
        caseToBeCreated: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('not creator', []),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: true,
        expectedDescription: 'user is creator and case is open',
        caseToBeCreated: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('creator', []),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: false,
        expectedDescription: 'user is creator but case is closed',
        caseToBeCreated: {
          status: 'closed',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('creator', []),
      },
      {
        conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
        expectedResult: false,
        expectedDescription: 'case is open but user is not creator',
        caseToBeCreated: {
          status: 'open',
          info: {},
          twilioWorkerId: 'creator',
          helpline,
          createdBy: workerSid,
          accountSid,
        },
        user: new User('not creator', []),
      },
    ].map(addPrettyConditionsSets),
    // .flatMap(mapTestToActions(actionsMaps.case)),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, caseToBeCreated, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

      Object.values(actionsMaps.case).forEach(action =>
        test(`${action}`, async () => {
          const createdCase = new Case();
          createdCase.dataValues = caseToBeCreated;
          expect(can(user, action, createdCase)).toBe(expectedResult);
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
        contactToBeCreated: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: new User('not creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is owner',
        contactToBeCreated: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: new User('creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is supervisor',
        contactToBeCreated: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: new User('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedResult: true,
        expectedDescription: 'is supervisor',
        contactToBeCreated: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: new User('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isOwner']],
        expectedResult: true,
        expectedDescription: 'is owner',
        contactToBeCreated: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: new User('creator', []),
      },
      {
        conditionsSets: [['isOwner']],
        expectedResult: false,
        expectedDescription: 'is not owner',
        contactToBeCreated: {
          accountSid,
          twilioWorkerId: 'creator',
        },
        user: new User('not creator', []),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, contactToBeCreated, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

      Object.values(actionsMaps.contact).forEach(action =>
        test(`${action}`, async () => {
          const createdContact = new Contact();
          createdContact.dataValues = contactToBeCreated;
          expect(can(user, action, createdContact)).toBe(expectedResult);
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
        postSurveyToBeCreated: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: new User('not creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'not supervisor',
        postSurveyToBeCreated: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: new User('not creator', []),
      },
      {
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is supervisor',
        postSurveyToBeCreated: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: new User('not creator', ['supervisor']),
      },
      {
        conditionsSets: [['isSupervisor']],
        expectedResult: true,
        expectedDescription: 'is supervisor',
        postSurveyToBeCreated: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: new User('not creator', ['supervisor']),
      },
    ].map(addPrettyConditionsSets),
  ).describe(
    'Expect $expectedResult when $expectedDescription with $prettyConditionsSets',
    ({ conditionsSets, postSurveyToBeCreated, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

      Object.values(actionsMaps.postSurvey).forEach(action =>
        test(`${action}`, async () => {
          const createdPostSurvey = new PostSurvey();
          createdPostSurvey.dataValues = postSurveyToBeCreated;
          expect(can(user, action, createdPostSurvey)).toBe(expectedResult);
        }),
      );
    },
  );
});
