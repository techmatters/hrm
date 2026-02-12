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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const formatISO_1 = __importDefault(require("date-fns/formatISO"));
const subMinutes_1 = __importDefault(require("date-fns/subMinutes"));
const crypto_1 = require("crypto");
const server_1 = require("../server");
const contactService = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
const mocks_1 = require("../mocks");
const dbCleanup_1 = require("../dbCleanup");
const jest_each_1 = __importDefault(require("jest-each"));
const date_fns_1 = require("date-fns");
const setupServiceTest_1 = require("../setupServiceTest");
const accountSid = `AC${(0, crypto_1.randomBytes)(16).toString('hex')}`;
const userTwilioWorkerId = `WK${(0, crypto_1.randomBytes)(16).toString('hex')}`;
const anotherUserTwilioWorkerId = `WK${(0, crypto_1.randomBytes)(16).toString('hex')}`;
const rawJson = {
    callType: 'Silent',
    categories: {},
    caseInformation: {
        actionTaken: '',
        callSummary: '',
        okForCaseWorkerToCall: null,
        hasConversationEvolved: 'Não',
        didYouDiscussRightsWithTheChild: null,
        didTheChildFeelWeSolvedTheirProblem: null,
    },
    contactlessTask: {
        date: '',
        time: '',
        channel: '',
        helpline: 'SaferNet',
        createdOnBehalfOf: userTwilioWorkerId,
    },
    childInformation: {
        age: '',
        city: '',
        lastName: '',
        firstName: '',
        email: '',
        state: '',
        gender: '',
        phone1: '',
        phone2: '',
        ethnicity: '',
    },
    callerInformation: {
        age: '',
        city: '',
        lastName: '',
        firstName: '',
        email: '',
        state: '',
        gender: '',
        phone1: '',
        phone2: '',
        relationshipToChild: '',
    },
    definitionVersion: 'br-v1',
};
const createContact = async (twilioWorkerId, created) => {
    const timeOfContact = (0, formatISO_1.default)(created ?? (0, subMinutes_1.default)(new Date(), 5));
    const taskSid = `WT${(0, crypto_1.randomBytes)(16).toString('hex')}`;
    const channelSid = `CH${(0, crypto_1.randomBytes)(16).toString('hex')}`;
    return contactService.createContact(accountSid, twilioWorkerId, {
        rawJson,
        twilioWorkerId,
        timeOfContact,
        taskId: taskSid,
        channelSid,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'as-v1',
    }, mocks_1.ALWAYS_CAN, true);
};
const overridePermissions = (key, permissions) => {
    (0, server_1.useOpenRules)();
    const rules = {
        [key]: permissions,
    };
    (0, server_1.setRules)(rules);
};
const overrideViewContactPermissions = (permissions) => overridePermissions('viewContact', permissions);
const { request } = (0, setupServiceTest_1.setupServiceTests)(userTwilioWorkerId);
describe('isOwner', () => {
    const testCases = [
        {
            description: 'return only contacts created by the owner when it has isOwner permission',
            viewContactPermissions: [['isOwner']],
            expectedContactsByOwner: [userTwilioWorkerId],
        },
        {
            description: 'returns everything if isOwner condition set is alongside an everyone set',
            viewContactPermissions: [['isOwner'], ['everyone']],
            expectedContactsByOwner: [userTwilioWorkerId, anotherUserTwilioWorkerId],
        },
    ];
    let usersContact;
    let anotherUsersContact;
    beforeEach(async () => {
        usersContact = await createContact(userTwilioWorkerId);
        anotherUsersContact = await createContact(anotherUserTwilioWorkerId);
    });
    describe('GET /contacts/:id', () => {
        const routeBase = `/v0/accounts/${accountSid}/contacts`;
        (0, jest_each_1.default)(testCases).test('$description', async ({ viewContactPermissions, expectedContactsByOwner }) => {
            overrideViewContactPermissions(viewContactPermissions);
            const responses = await Promise.all([usersContact, anotherUsersContact].map(contact => request.get(`${routeBase}/${contact.id}`).set(server_1.headers)));
            const retrievedContacts = responses
                .filter(({ status }) => {
                if (status == 200) {
                    return true;
                }
                else {
                    expect(status).toBe(404);
                    return false;
                }
            })
                .map(({ body }) => body);
            expect(retrievedContacts
                .map((contact) => contact.twilioWorkerId)
                .sort()).toStrictEqual(expectedContactsByOwner.sort());
        });
    });
});
describe('Time based condition', () => {
    let sampleContacts;
    // Not great to be using the current time from a determinism standpoint.
    // Unfortunately, faking out the date & time with Jest borks the DB client when interacting with a DB container still using the correct time
    // The alternative is to add lots of 'for testing' injection points for dates, but this seems like it could be abused or broken easily
    // This way we only need to add one injection point for the current time, and that's on an internal function that's not exposed to the outside world.
    const BASELINE_DATE = new Date();
    const contactCreatedTimes = [
        (0, date_fns_1.subDays)(BASELINE_DATE, 3),
        (0, date_fns_1.subDays)(BASELINE_DATE, 2),
        (0, date_fns_1.subDays)(BASELINE_DATE, 1),
        (0, date_fns_1.subHours)(BASELINE_DATE, 12),
        (0, date_fns_1.subHours)(BASELINE_DATE, 9),
        (0, date_fns_1.subHours)(BASELINE_DATE, 6),
    ];
    const BASELINE_DATE_FOR_VALIDATION = (0, date_fns_1.addMinutes)(BASELINE_DATE, 10);
    beforeEach(async () => {
        (0, server_1.useOpenRules)();
        sampleContacts = {};
        for (const [idx, createdAt] of Object.entries(contactCreatedTimes)) {
            sampleContacts[createdAt.toISOString()] = await createContact(parseInt(idx) % 2 === 0 ? userTwilioWorkerId : anotherUserTwilioWorkerId, createdAt);
        }
    });
    afterEach(async () => {
        await (0, dbCleanup_1.clearAllTables)();
    });
    const testCases = [
        {
            description: 'Any time based condition should be ignored if there is also an everyone condition set.',
            permissions: [['everyone'], [{ createdHoursAgo: 1 }]],
            expectedPermittedContactCreationTimes: contactCreatedTimes,
        },
        {
            description: 'Any time based condition should be ignored if there is also an all excluding condition in the set.',
            permissions: [[{ createdDaysAgo: 10 }, 'isSupervisor']],
            expectedPermittedContactCreationTimes: [],
        },
        {
            description: 'Should exclude all cases with a createdAt date older than the number of hours prior to the current time if only a createdHoursAgo condition is set',
            permissions: [[{ createdHoursAgo: 8 }]],
            expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct => (0, date_fns_1.isAfter)(cct, (0, date_fns_1.subHours)(BASELINE_DATE_FOR_VALIDATION, 8))),
        },
        {
            description: 'Should exclude all cases with a createdAt date older than the number of days prior to the current time if only a createdHoursAgo condition is set',
            permissions: [['everyone', { createdDaysAgo: 1 }]],
            expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct => (0, date_fns_1.isAfter)(cct, (0, date_fns_1.subDays)(BASELINE_DATE_FOR_VALIDATION, 1))),
        },
        {
            description: 'should use createdDaysAgo if both time based conditions are set but createdDaysAgo is the shorter duration',
            permissions: [[{ createdDaysAgo: 1, createdHoursAgo: 60 }]],
            expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct => (0, date_fns_1.isAfter)(cct, (0, date_fns_1.subDays)(BASELINE_DATE_FOR_VALIDATION, 1))),
        },
        {
            description: 'should use createdHoursAgo if both time based conditions are set but createdHoursAgo is the shorter duration',
            permissions: [['everyone', { createdDaysAgo: 2, createdHoursAgo: 7 }]],
            expectedPermittedContactCreationTimes: contactCreatedTimes.filter(cct => (0, date_fns_1.isAfter)(cct, (0, date_fns_1.subHours)(BASELINE_DATE_FOR_VALIDATION, 7))),
        },
        {
            description: 'Should combine with other conditions in the same set',
            permissions: [['isOwner', { createdDaysAgo: 2, createdHoursAgo: 7 }]],
            expectedPermittedContactCreationTimes: contactCreatedTimes.filter((cct, idx) => (0, date_fns_1.isAfter)(cct, (0, date_fns_1.subHours)(BASELINE_DATE_FOR_VALIDATION, 7)) && idx % 2 === 0),
        },
        {
            description: 'Should combine with other conditions in other sets',
            permissions: [['isOwner'], [{ createdDaysAgo: 2, createdHoursAgo: 7 }]],
            expectedPermittedContactCreationTimes: contactCreatedTimes.filter((cct, idx) => (0, date_fns_1.isAfter)(cct, (0, date_fns_1.subHours)(BASELINE_DATE_FOR_VALIDATION, 7)) || idx % 2 === 0),
        },
    ];
    const route = `/v0/accounts/${accountSid}/contacts`;
    describe('/contact/:id route - GET', () => {
        (0, jest_each_1.default)(testCases).test('$description', async ({ permissions, expectedPermittedContactCreationTimes }) => {
            const subRoute = id => `${route}/${id}`;
            (0, server_1.setRules)({ viewContact: permissions });
            const responses = await Promise.all(Object.values(sampleContacts).map(async (c) => request.get(subRoute(c.id)).set(server_1.headers)));
            const permitted = responses
                .filter(({ status }) => {
                if (status === 200)
                    return true;
                expect(status).toBe(404);
                return false;
            })
                .map(r => r.body);
            expect(permitted
                .map(p => (0, date_fns_1.parseISO)(p.timeOfContact))
                .sort((a, b) => a.valueOf() - b.valueOf())).toEqual(expectedPermittedContactCreationTimes.map(cct => (0, date_fns_1.parseISO)(sampleContacts[cct.toISOString()].timeOfContact)));
        });
    });
});
