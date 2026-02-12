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
const server_1 = require("./server");
const contactDb = __importStar(require("@tech-matters/hrm-core/contact/contactDataAccess"));
const contactService = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
const mocks_1 = require("./mocks");
const setupServiceTest_1 = require("./setupServiceTest");
const caseDataAccess_1 = require("@tech-matters/hrm-core/case/caseDataAccess");
const accountSid = `AC${(0, crypto_1.randomBytes)(16).toString('hex')}`;
const userTwilioWorkerId = `WK${(0, crypto_1.randomBytes)(16).toString('hex')}`;
const anotherUserTwilioWorkerId = `WK${(0, crypto_1.randomBytes)(16).toString('hex')}`;
const { request } = (0, setupServiceTest_1.setupServiceTests)(userTwilioWorkerId);
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
    definitionVersion: 'as-v1',
};
const createContact = async (twilioWorkerId) => {
    const timeOfContact = (0, formatISO_1.default)((0, subMinutes_1.default)(new Date(), 5));
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
    }, mocks_1.ALWAYS_CAN);
};
const createCase = async (twilioWorkerId) => {
    return (0, caseDataAccess_1.create)({
        createdAt: new Date().toISOString(),
        createdBy: twilioWorkerId,
        accountSid,
        twilioWorkerId,
        status: 'open',
        helpline: 'helpline',
        info: { summary: 'something summery' },
        definitionVersion: 'as-v1',
    });
};
const overridePermissions = (key, permissions) => {
    (0, server_1.useOpenRules)();
    const rules = {
        [key]: permissions,
    };
    (0, server_1.setRules)(rules);
};
const overrideViewCasePermissions = (permissions) => overridePermissions('viewCase', permissions);
describe('list cases permissions', () => {
    const route = `/v0/accounts/${accountSid}/cases/list`;
    let userCase, otherUserCase;
    beforeEach(async () => {
        userCase = await createCase(userTwilioWorkerId);
        otherUserCase = await createCase(anotherUserTwilioWorkerId);
    });
    test('return zero cases when no permissions', async () => {
        overrideViewCasePermissions([['isSupervisor'], ['isCreator']]);
        const searchParams = {
            filters: {
                counsellors: [anotherUserTwilioWorkerId],
            },
        };
        const response = await request.post(route).set(server_1.headers).send(searchParams);
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(0);
        expect(response.body.cases.length).toBe(0);
    });
    test('return cases from other counselors', async () => {
        overrideViewCasePermissions([['everyone']]);
        const searchParams = {
            filters: {
                counsellors: [anotherUserTwilioWorkerId],
            },
        };
        const response = await request.post(route).set(server_1.headers).send(searchParams);
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(1);
        expect(response.body.cases.length).toBe(1);
        expect(response.body.cases[0].id).toBe(otherUserCase.id.toString());
    });
    test('return own cases when view is restricted', async () => {
        overrideViewCasePermissions([['isCreator']]);
        const response = await request.post(route).set(server_1.headers).send({});
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(1);
        expect(response.body.cases.length).toStrictEqual(1);
        expect(response.body.cases[0].id).toBe(userCase.id.toString());
    });
    test('return all cases', async () => {
        overrideViewCasePermissions([['everyone']]);
        const response = await request.post(route).set(server_1.headers).send({});
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(2);
        expect(response.body.cases.length).toBe(2);
    });
    describe('A contact in the case is owned by the user', () => {
        let userContact, userContact2, otherUserContact;
        let caseWithUserContact, caseWithNoUserContact, userCaseWithUserContact;
        const ctc = contactDb.connectToCase();
        const connect = (contactId, caseId) => ctc(accountSid, contactId.toString(), caseId.toString(), userTwilioWorkerId);
        beforeEach(async () => {
            [
                userContact,
                userContact2,
                otherUserContact,
                caseWithNoUserContact,
                caseWithUserContact,
                userCaseWithUserContact,
            ] = await Promise.all([
                createContact(userTwilioWorkerId),
                createContact(userTwilioWorkerId),
                createContact(anotherUserTwilioWorkerId),
                createCase(anotherUserTwilioWorkerId),
                createCase(anotherUserTwilioWorkerId),
                createCase(userTwilioWorkerId),
            ]);
            await Promise.all([
                connect(parseInt(userContact.id), caseWithUserContact.id),
                connect(parseInt(otherUserContact.id), caseWithUserContact.id),
                connect(parseInt(otherUserContact.id), caseWithNoUserContact.id),
                connect(parseInt(userContact2.id), userCaseWithUserContact.id),
            ]);
        });
        test('Ignores owned contact when isCaseContactOwner permission is not in use', async () => {
            overrideViewCasePermissions([['everyone']]);
            const response = await request.post(route).set(server_1.headers).send({});
            expect(response.status).toBe(200);
            expect(response.body.count).toBe(5);
            expect(response.body.cases.length).toBe(5);
            expect(response.body.cases.map((c) => c.id).sort()).toEqual([
                userCase,
                otherUserCase,
                caseWithNoUserContact,
                caseWithUserContact,
                userCaseWithUserContact,
            ]
                .map((c) => c.id)
                .sort()
                .map(id => id.toString()));
        });
        test('Returns only cases with a connected contact owned by the user when isCaseContactOwner permission is in use', async () => {
            overrideViewCasePermissions([['isCaseContactOwner']]);
            const response = await request.post(route).set(server_1.headers).send({});
            expect(response.status).toBe(200);
            expect(response.body.count).toBe(2);
            expect(response.body.cases.length).toBe(2);
            expect(response.body.cases.map((c) => c.id).sort()).toEqual([caseWithUserContact, userCaseWithUserContact]
                .map((c) => c.id)
                .sort()
                .map(id => id.toString()));
        });
        test('Combines with counselor filters to only return cases created by counselors listed in the filter with contacts owned by the user', async () => {
            overrideViewCasePermissions([['isCaseContactOwner']]);
            const response = await request
                .post(route)
                .set(server_1.headers)
                .send({
                filters: {
                    counsellors: [anotherUserTwilioWorkerId],
                },
            });
            expect(response.status).toBe(200);
            expect(response.body.count).toBe(1);
            expect(response.body.cases.length).toBe(1);
            expect(response.body.cases.map((c) => c.id).sort()).toEqual([caseWithUserContact]
                .map((c) => c.id)
                .sort()
                .map(id => id.toString()));
        });
        test('Combines with isCreator condition to only return cases created by the user AND with contacts owned by the user', async () => {
            overrideViewCasePermissions([['isCaseContactOwner', 'isCreator']]);
            const response = await request.post(route).set(server_1.headers).send({});
            expect(response.status).toBe(200);
            expect(response.body.count).toBe(1);
            expect(response.body.cases.length).toBe(1);
            expect(response.body.cases.map((c) => c.id).sort()).toEqual([userCaseWithUserContact]
                .map((c) => c.id)
                .sort()
                .map(id => id.toString()));
        });
        test('Combines with a separate isCreator condition set to return cases created by the user OR with contacts owned by the user', async () => {
            overrideViewCasePermissions([['isCaseContactOwner'], ['isCreator']]);
            const response = await request.post(route).set(server_1.headers).send({});
            expect(response.status).toBe(200);
            expect(response.body.count).toBe(3);
            expect(response.body.cases.length).toBe(3);
            expect(response.body.cases.map((c) => c.id).sort()).toEqual([userCase, caseWithUserContact, userCaseWithUserContact]
                .map((c) => c.id)
                .sort()
                .map(id => id.toString()));
        });
    });
});
