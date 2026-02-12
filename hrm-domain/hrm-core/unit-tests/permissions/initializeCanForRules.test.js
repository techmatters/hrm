"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable jest/no-standalone-expect */
const jest_each_1 = __importDefault(require("jest-each"));
const initializeCanForRules_1 = require("../../permissions/initializeCanForRules");
const permissions_1 = require("../../permissions");
const mocks_1 = require("../mocks");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const date_fns_1 = require("date-fns");
const helpline = 'helpline';
const buildRules = (partialRules) => {
    const entries = Object.entries(permissions_1.actionsMaps)
        .flatMap(([tk, obj]) => Object.values(obj).map(action => [tk, action]))
        .map(([tk, action]) => {
        return [action, partialRules[tk] || partialRules.default || []];
    });
    return Object.fromEntries(entries);
};
const creatorSid = 'WK creator';
const notCreatorSid = 'WK not creator';
const supervisorSid = 'WK supervisor';
const notSupervisorSid = 'WK not supervisor';
describe('Test that all actions work fine (everyone)', () => {
    const rules = buildRules({ default: [['everyone']] });
    const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
    const notCreator = (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []);
    const testCases = Object.values(permissions_1.actionsMaps.case).map(action => ({
        action,
        caseObj: {
            label: 'case label',
            id: '123',
            status: 'open',
            info: {},
            sections: {},
            categories: {},
            twilioWorkerId: creatorSid,
            helpline,
            createdBy: mocks_1.workerSid,
            accountSid: mocks_1.accountSid,
            updatedBy: null,
            createdAt: (0, date_fns_1.subDays)(new Date(), 1).toISOString(),
            updatedAt: null,
            precalculatedPermissions: {
                userOwnsContact: false,
            },
            definitionVersion: 'as-v1',
        },
        user: notCreator,
    }));
    // Test Case permissions
    (0, jest_each_1.default)(testCases).test('Action $action should return true', async ({ action, caseObj, user }) => {
        expect(can(user, action, caseObj)).toBeTruthy();
    });
    // Test Contact permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.contact).map(action => ({
        action,
        contactObj: {
            accountSid: mocks_1.accountSid,
            twilioWorkerId: creatorSid,
        },
        user: notCreator,
    }))).test('Action $action should return true', async ({ action, contactObj, user }) => {
        expect(can(user, action, contactObj)).toBeTruthy();
    });
    // Test PostSurvey permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.postSurvey).map(action => ({
        action,
        postSurveyObj: {
            accountSid: mocks_1.accountSid,
            taskId: 'task-sid',
            contactTaskId: 'contact-task-id',
            data: {},
        },
        user: notCreator,
    }))).test('Action $action should return true', async ({ action, postSurveyObj, user }) => {
        expect(can(user, action, postSurveyObj)).toBeTruthy();
    });
});
describe('Test that all actions work fine (no one)', () => {
    const rules = buildRules({ default: [] });
    const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
    const supervisor = (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, creatorSid, ['supervisor']);
    // Test Case permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.case).map(action => ({
        action,
        caseObj: {
            status: 'open',
            info: {},
            twilioWorkerId: creatorSid,
            helpline,
            createdBy: mocks_1.workerSid,
            accountSid: mocks_1.accountSid,
        },
        user: supervisor,
    }))).test('Action $action should return false', async ({ action, caseObj, user }) => {
        expect(can(user, action, caseObj)).toBeFalsy();
    });
    // Test Contact permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.contact).map(action => ({
        action,
        contactObj: {
            accountSid: mocks_1.accountSid,
            twilioWorkerId: creatorSid,
        },
        user: supervisor,
    }))).test('Action $action should return true', async ({ action, contactObj, user }) => {
        expect(can(user, action, contactObj)).toBeFalsy();
    });
    // Test PostSurvey permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.postSurvey).map(action => ({
        action,
        postSurveyObj: {
            accountSid: mocks_1.accountSid,
            taskId: 'task-sid',
            contactTaskId: 'contact-task-id',
            data: {},
        },
        user: supervisor,
    }))).test('Action $action should return false', async ({ action, postSurveyObj, user }) => {
        expect(can(user, action, postSurveyObj)).toBeFalsy();
    });
});
/**
 * This test suite checks that [[]] (an empty list within the conditions sets for a given action)
 * does not result in granting permissions when it shouldn't.
 * The reason is how checkConditionsSet is implemented: [].every(predicate) evaluates true for all predicates
 */
describe('Test that an empty set of conditions does not grants permissions', () => {
    const rules = buildRules({ default: [[]] });
    const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
    const supervisor = (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, creatorSid, ['supervisor']);
    // Test Case permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.case).map(action => ({
        action,
        caseObj: {
            status: 'open',
            info: {},
            twilioWorkerId: creatorSid,
            helpline,
            createdBy: mocks_1.workerSid,
            accountSid: mocks_1.accountSid,
        },
        user: supervisor,
    }))).test('Action $action should return false', async ({ action, caseObj, user }) => {
        expect(can(user, action, caseObj)).toBeFalsy();
    });
    // Test Contact permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.contact).map(action => ({
        action,
        contactObj: {
            accountSid: mocks_1.accountSid,
            twilioWorkerId: creatorSid,
        },
        user: supervisor,
    }))).test('Action $action should return true', async ({ action, contactObj, user }) => {
        expect(can(user, action, contactObj)).toBeFalsy();
    });
    // Test PostSurvey permissions
    (0, jest_each_1.default)(Object.values(permissions_1.actionsMaps.postSurvey).map(action => ({
        action,
        postSurveyObj: {
            accountSid: mocks_1.accountSid,
            taskId: 'task-sid',
            contactTaskId: 'contact-task-id',
            data: {},
        },
        user: supervisor,
    }))).test('Action $action should return false', async ({ action, postSurveyObj, user }) => {
        expect(can(user, action, postSurveyObj)).toBeFalsy();
    });
});
const addPrettyConditionsSets = t => ({
    ...t,
    prettyConditionsSets: t.conditionsSets.map(cs => `[${cs.map(c => (typeof c === 'object' ? JSON.stringify(c) : c)).join(',')}]`),
});
// Test Case permissions
describe('Test different scenarios (Case)', () => {
    (0, jest_each_1.default)([
        {
            conditionsSets: [['everyone']],
            expectedResult: true,
            expectedDescription: 'is not creator nor supervisor, case is open',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [['everyone']],
            expectedResult: true,
            expectedDescription: 'is not creator nor supervisor, case is closed',
            caseObj: {
                status: 'closed',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [], // no one
            expectedResult: false,
            expectedDescription: 'user is creator, supervisor, case is open',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, creatorSid, ['supervisor']),
        },
        {
            conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
            expectedResult: true,
            expectedDescription: 'user is supervisor but not creator, case open',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, ['supervisor']),
        },
        {
            conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
            expectedResult: true,
            expectedDescription: 'user is supervisor but not creator, case closed',
            caseObj: {
                status: 'closed',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, ['supervisor']),
        },
        {
            conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
            expectedResult: false,
            expectedDescription: 'user is not supervisor nor creator',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
            expectedResult: true,
            expectedDescription: 'user is creator and case is open',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, creatorSid, []),
        },
        {
            conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
            expectedResult: false,
            expectedDescription: 'user is creator but case is closed',
            caseObj: {
                status: 'closed',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, creatorSid, []),
        },
        {
            conditionsSets: [['isSupervisor'], ['isCreator', 'isCaseOpen']],
            expectedResult: false,
            expectedDescription: 'case is open but user is not creator',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdHoursAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdHoursAgo within the provided range',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdHoursAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdHoursAgo outside the provided range',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdDaysAgo within the provided range',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdDaysAgo outside the provided range',
            caseObj: {
                status: 'open',
                info: {},
                twilioWorkerId: creatorSid,
                helpline,
                createdBy: mocks_1.workerSid,
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
    ].map(addPrettyConditionsSets)).describe('Expect $expectedResult when $expectedDescription with $prettyConditionsSets', ({ conditionsSets, caseObj, user, expectedResult }) => {
        const rules = buildRules({ case: conditionsSets });
        const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
        Object.values(permissions_1.actionsMaps.case).forEach(action => test(`${action}`, async () => {
            expect(can(user, action, caseObj)).toBe(expectedResult);
        }));
    });
});
// Test Contact permissions
describe('Test different scenarios (Contact)', () => {
    (0, jest_each_1.default)([
        {
            conditionsSets: [['everyone']],
            expectedResult: true,
            expectedDescription: 'not supervisor',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [],
            expectedResult: false,
            expectedDescription: 'is owner',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, creatorSid, []),
        },
        {
            conditionsSets: [],
            expectedResult: false,
            expectedDescription: 'is supervisor',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, ['supervisor']),
        },
        {
            conditionsSets: [['isSupervisor']],
            expectedResult: true,
            expectedDescription: 'is supervisor',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, ['supervisor']),
        },
        {
            conditionsSets: [['isOwner']],
            expectedResult: true,
            expectedDescription: 'is owner',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, creatorSid, []),
        },
        {
            conditionsSets: [['isOwner']],
            expectedResult: false,
            expectedDescription: 'is not owner',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdHoursAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdHoursAgo within the provided range',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdHoursAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdHoursAgo outside the provided range',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdDaysAgo within the provided range',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdDaysAgo outside the provided range',
            contactObj: {
                accountSid: mocks_1.accountSid,
                twilioWorkerId: creatorSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
    ].map(addPrettyConditionsSets)).describe('Expect $expectedResult when $expectedDescription with $prettyConditionsSets', ({ conditionsSets, contactObj, user, expectedResult }) => {
        const rules = buildRules({ contact: conditionsSets });
        const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
        Object.values(permissions_1.actionsMaps.contact).forEach(action => test(`${action}`, async () => {
            expect(can(user, action, contactObj)).toBe(expectedResult);
        }));
    });
});
// Test Profile permissions
describe('Test different scenarios (Profile)', () => {
    (0, jest_each_1.default)([
        {
            conditionsSets: [['everyone']],
            expectedDescription: 'not supervisor',
            profileObj: {
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
            expectedResult: true,
        },
        {
            conditionsSets: [['isSupervisor']],
            expectedDescription: 'not supervisor',
            profileObj: {
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
            expectedResult: false,
        },
        {
            conditionsSets: [['isSupervisor']],
            expectedDescription: 'is supervisor',
            profileObj: {
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, supervisorSid, ['supervisor']),
            expectedResult: true,
        },
        {
            conditionsSets: [[{ createdHoursAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdHoursAgo within the provided range',
            profileObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ createdHoursAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdHoursAgo outside the provided range',
            profileObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdDaysAgo within the provided range',
            profileObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdDaysAgo outside the provided range',
            profileObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
    ].map(addPrettyConditionsSets)).describe('Expect $expectedResult when $expectedDescription with $prettyConditionsSets', ({ conditionsSets, profileObj, user, expectedResult }) => {
        const rules = buildRules({ profile: conditionsSets });
        const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
        Object.values(permissions_1.actionsMaps.profile).forEach(action => test(`${action}`, async () => {
            expect(can(user, action, profileObj)).toBe(expectedResult);
        }));
    });
});
// Test ProfileSection permissions
describe('Test different scenarios (ProfileSection)', () => {
    (0, jest_each_1.default)([
        {
            conditionsSets: [['everyone']],
            expectedDescription: 'not supervisor',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
            expectedResult: true,
        },
        {
            conditionsSets: [['isSupervisor']],
            expectedDescription: 'not supervisor',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
            expectedResult: false,
        },
        {
            conditionsSets: [['isSupervisor']],
            expectedDescription: 'is supervisor',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, supervisorSid, ['supervisor']),
            expectedResult: true,
        },
        {
            conditionsSets: [[{ createdHoursAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdHoursAgo within the provided range',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ createdHoursAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdHoursAgo outside the provided range',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subHours)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 2 }]],
            expectedResult: true,
            expectedDescription: 'createdDaysAgo within the provided range',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ createdDaysAgo: 1 }]],
            expectedResult: false,
            expectedDescription: 'createdDaysAgo outside the provided range',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
                createdAt: (0, date_fns_1.subDays)(Date.now(), 1).toISOString(),
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ sectionType: 'summary' }]],
            expectedResult: true,
            expectedDescription: 'sectionType is summary',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
                sectionType: 'summary',
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
        {
            conditionsSets: [[{ sectionType: 'other' }]],
            expectedResult: false,
            expectedDescription: 'sectionType is summary',
            profileSectionObj: {
                accountSid: mocks_1.accountSid,
                sectionType: 'summary',
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notSupervisorSid, []),
        },
    ].map(addPrettyConditionsSets)).describe('Expect $expectedResult when $expectedDescription with $prettyConditionsSets', ({ conditionsSets, profileSectionObj, user, expectedResult }) => {
        const rules = buildRules({ profileSection: conditionsSets });
        const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
        Object.values(permissions_1.actionsMaps.profileSection).forEach(action => test(`${action}`, async () => {
            expect(can(user, action, profileSectionObj)).toBe(expectedResult);
        }));
    });
});
// Test PostSurvey permissions
describe('Test different scenarios (PostSurvey)', () => {
    (0, jest_each_1.default)([
        {
            conditionsSets: [['everyone']],
            expectedResult: true,
            expectedDescription: 'not supervisor',
            postSurveyObj: {
                accountSid: mocks_1.accountSid,
                taskId: 'task-sid',
                contactTaskId: 'contact-task-id',
                data: {},
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [],
            expectedResult: false,
            expectedDescription: 'not supervisor',
            postSurveyObj: {
                accountSid: mocks_1.accountSid,
                taskId: 'task-sid',
                contactTaskId: 'contact-task-id',
                data: {},
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, []),
        },
        {
            conditionsSets: [],
            expectedResult: false,
            expectedDescription: 'is supervisor',
            postSurveyObj: {
                accountSid: mocks_1.accountSid,
                taskId: 'task-sid',
                contactTaskId: 'contact-task-id',
                data: {},
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, ['supervisor']),
        },
        {
            conditionsSets: [['isSupervisor']],
            expectedResult: true,
            expectedDescription: 'is supervisor',
            postSurveyObj: {
                accountSid: mocks_1.accountSid,
                taskId: 'task-sid',
                contactTaskId: 'contact-task-id',
                data: {},
            },
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, notCreatorSid, ['supervisor']),
        },
    ].map(addPrettyConditionsSets)).describe('Expect $expectedResult when $expectedDescription with $prettyConditionsSets', ({ conditionsSets, postSurveyObj, user, expectedResult }) => {
        const rules = buildRules({ postSurvey: conditionsSets });
        const can = (0, initializeCanForRules_1.initializeCanForRules)(rules);
        Object.values(permissions_1.actionsMaps.postSurvey).forEach(action => test(`${action}`, async () => {
            expect(can(user, action, postSurveyObj)).toBe(expectedResult);
        }));
    });
});
