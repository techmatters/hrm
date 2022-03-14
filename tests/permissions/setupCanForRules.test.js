/* eslint-disable jest/no-standalone-expect */
const each = require('jest-each').default;

const models = require('../../models');
const { setupCanForRules } = require('../../permissions/setupCanForRules');
const { actionsMaps } = require('../../permissions/actions');
const { User } = require('../../permissions');

const { Case, PostSurvey } = models;

const accountSid = 'account-sid';
const helpline = 'helpline';
const workerSid = 'worker-sid';
const options = { context: { workerSid } };

const buildRules = conditionsSets =>
  Object.values(actionsMaps)
    .flatMap(e => Object.values(e))
    .reduce((accum, action) => ({ ...accum, [action]: conditionsSets }), {});

// each([
//   {
//     dataValues: {
//       id: 123,
//       status: 'open',
//       helpline: 'helpline',
//       info: { notes: 'notes' },
//       twilioWorkerId: 'creator',
//       createdBy: 'creator',
//     },
//     user: new User('creator', []),
//   },
// ]);

describe('Test that all actions work fine (everyone)', () => {
  const rules = buildRules([['everyone']]);
  const can = setupCanForRules(rules);

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
      user: new User('not creator', []),
    })),
  ).test(`Action $action should return true`, async ({ action, caseToBeCreated, user }) => {
    const createdCase = await Case.create(caseToBeCreated, options);
    expect(can(user, action, createdCase)).toBeTruthy();
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
      user: new User('not creator', []),
    })),
  ).test(`Action $action should return true`, async ({ action, postSurveyToBeCreated, user }) => {
    const createdPostSurvey = await PostSurvey.create(postSurveyToBeCreated);
    expect(can(user, action, createdPostSurvey)).toBeTruthy();
  });
});

// Given one single actions array (i.e. actionsMaps.case or actionsMaps.postSurvey values converted to array), returns a random action within
const getRandomAction = actionsMap =>
  actionsMap[Math.floor(Math.random() * 100) % actionsMap.length];
const getRandomCaseAction = () => getRandomAction(Object.values(actionsMaps.case));
const getRandomPostSurveyAction = () => getRandomAction(Object.values(actionsMaps.postSurvey));

describe('Test different scenarios (random action)', () => {
  // Test Case permissions
  each(
    [
      {
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
        action: getRandomCaseAction(),
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
    ].map(t => ({ ...t, prettyConditionsSets: t.conditionsSets.map(arr => `[${arr.join(',')}]`) })),
  ).test(
    `Should return $expectedResult when $expectedDescription and conditionsSets are $prettyConditionsSets`,
    async ({ action, conditionsSets, caseToBeCreated, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

      const createdCase = await Case.create(caseToBeCreated, options);
      expect(can(user, action, createdCase)).toBe(expectedResult);
    },
  );

  // Test PostSurvey permissions
  each(
    [
      {
        action: getRandomPostSurveyAction(),
        conditionsSets: [['everyone']],
        expectedResult: true,
        expectedDescription: 'not supervisor but set for everyone',
        postSurveyToBeCreated: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: new User('not creator', []),
      },
      {
        action: getRandomPostSurveyAction(),
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'not supervisor and set for no one',
        postSurveyToBeCreated: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: new User('not creator', []),
      },
      {
        action: getRandomPostSurveyAction(),
        conditionsSets: [],
        expectedResult: false,
        expectedDescription: 'is supervisor but set for no one',
        postSurveyToBeCreated: {
          accountSid,
          taskId: 'task-sid',
          contactTaskId: 'contact-task-id',
          data: {},
        },
        user: new User('not creator', ['supervisor']),
      },
      {
        action: getRandomPostSurveyAction(),
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
    ].map(t => ({ ...t, prettyConditionsSets: t.conditionsSets.map(arr => `[${arr.join(',')}]`) })),
  ).test(
    `Should return $expectedResult when $expectedDescription and conditionsSets are $prettyConditionsSets`,
    async ({ action, conditionsSets, postSurveyToBeCreated, user, expectedResult }) => {
      const rules = buildRules(conditionsSets);
      const can = setupCanForRules(rules);

      const createdPostSurvey = await PostSurvey.create(postSurveyToBeCreated, options);
      expect(can(user, action, createdPostSurvey)).toBe(expectedResult);
    },
  );
});
