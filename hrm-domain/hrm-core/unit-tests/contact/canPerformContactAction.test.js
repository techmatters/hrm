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
const date_fns_1 = require("date-fns");
const contact_builder_1 = require("./contact-builder");
const twilio_client_1 = require("@tech-matters/twilio-client");
const contactService_1 = require("../../contact/contactService");
const http_errors_1 = __importDefault(require("http-errors"));
const canPerformContactAction_1 = require("../../contact/canPerformContactAction");
const caseService_1 = require("../../case/caseService");
const permissions_1 = require("../../permissions");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const testing_1 = require("@tech-matters/testing");
jest.mock('@tech-matters/twilio-client', () => ({
    getClient: jest.fn().mockResolvedValue({}),
    isTwilioTaskTransferTarget: jest.fn(),
}));
jest.mock('http-errors', () => jest.fn());
jest.mock('../../contact/contactService', () => ({
    getContactById: jest.fn(),
}));
jest.mock('../../case/caseService', () => ({
    getCase: jest.fn(),
}));
const mockGetContactById = contactService_1.getContactById;
const mockGetCase = caseService_1.getCase;
const mockCreateError = http_errors_1.default;
const mockIsTwilioTaskTransferTarget = twilio_client_1.isTwilioTaskTransferTarget;
const BASELINE_DATE = (0, date_fns_1.parseISO)('2022-05-05 12:00:00');
const accountSid1 = 'ACtwilio-hrm1';
const thisWorkerSid = 'WK-thisWorker';
const otherWorkerSid = 'WK-otherWorker';
beforeAll(async () => {
    await testing_1.mockingProxy.start();
    const mockttp = await testing_1.mockingProxy.mockttpServer();
    await (0, testing_1.mockSsmParameters)(mockttp, [
        { pathPattern: /.*\/auth_token$/, valueGenerator: () => 'account1 token' },
    ]);
});
afterAll(async () => {
    await testing_1.mockingProxy.stop();
});
let req;
let mockRequestMethods;
const next = jest.fn();
beforeEach(() => {
    mockRequestMethods = {
        permit: jest.fn(),
        block: jest.fn(),
        can: jest.fn(),
        isPermitted: jest.fn().mockReturnValue(false),
    };
    req = {
        ...mockRequestMethods,
        params: { contactId: 'contact1' },
        user: (0, twilio_worker_auth_1.newTwilioUser)('ACtwilio', 'WK-worker1', []),
        hrmAccountId: accountSid1,
        body: {},
    };
    next.mockClear();
    mockGetContactById.mockClear();
    mockCreateError.mockClear();
    mockGetCase.mockClear();
});
const expectNoop = () => {
    expect(http_errors_1.default).not.toHaveBeenCalled();
    expect(req.permit).not.toHaveBeenCalled();
    expect(req.block).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
};
const expectToBePermitted = () => {
    expect(http_errors_1.default).not.toHaveBeenCalled();
    expect(req.permit).toHaveBeenCalled();
    expect(req.block).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
};
const expectToBeBlocked = () => {
    expect(http_errors_1.default).not.toHaveBeenCalled();
    expect(req.permit).not.toHaveBeenCalled();
    expect(req.block).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
};
const draftContactTests = (expectToPermit, setup = () => Promise.resolve()) => () => {
    const expectedDescription = expectToBePermitted ? 'permits' : 'blocks';
    const expectation = expectToPermit ? expectToBePermitted : expectToBeBlocked;
    beforeEach(async () => {
        // Draft contact authorization doesn't care about the can response, so always return false
        mockRequestMethods.can.mockReturnValue(false);
        req.body = { conversationDuration: 123 };
        req.user = { ...req.user, accountSid: 'ACtwilio', workerSid: thisWorkerSid };
        await setup();
    });
    test(`Request user matches contact creator - ${expectedDescription}`, async () => {
        mockGetContactById.mockResolvedValue(new contact_builder_1.ContactBuilder()
            .withCreatedBy(thisWorkerSid)
            .withTwilioWorkerId(otherWorkerSid)
            .buildContact());
        await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
        expectation();
    });
    test(`Request user matches contact owner - ${expectedDescription}`, async () => {
        mockGetContactById.mockResolvedValue(new contact_builder_1.ContactBuilder()
            .withCreatedBy(otherWorkerSid)
            .withTwilioWorkerId(thisWorkerSid)
            .buildContact());
        await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
        expectation();
    });
    test(`Request user is not the owner or the creator, but is the target of a transfer - ${expectedDescription}`, async () => {
        mockGetContactById.mockResolvedValue(new contact_builder_1.ContactBuilder()
            .withCreatedBy(otherWorkerSid)
            .withTwilioWorkerId(otherWorkerSid)
            .withTaskId('original task')
            .buildContact());
        req.body.taskId = 'transfer task';
        mockIsTwilioTaskTransferTarget.mockResolvedValue(true);
        await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
        expect(twilio_client_1.getClient).toHaveBeenCalledWith({
            accountSid: 'ACtwilio',
        });
        expect(twilio_client_1.isTwilioTaskTransferTarget).toHaveBeenCalledWith(await (0, twilio_client_1.getClient)({ accountSid: accountSid1 }), 'transfer task', 'original task', thisWorkerSid);
        expectation();
    });
    test(`Request user is not the owner or the creator, but has EDIT_INPROGRESS_CONTACT - ${expectedDescription}`, async () => {
        mockGetContactById.mockResolvedValue(new contact_builder_1.ContactBuilder()
            .withCreatedBy(otherWorkerSid)
            .withTwilioWorkerId(otherWorkerSid)
            .withTaskId('original task')
            .buildContact());
        req.body.taskId = 'transfer task';
        mockRequestMethods.can.mockImplementation((user, action) => action === permissions_1.actionsMaps.contact.EDIT_INPROGRESS_CONTACT);
        mockIsTwilioTaskTransferTarget.mockResolvedValue(false);
        await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
        expect(twilio_client_1.getClient).toHaveBeenCalledWith({
            accountSid: 'ACtwilio',
        });
        expectation();
    });
    test('Request user is not the owner or the creator, nor target of a transfer - blocks', async () => {
        mockGetContactById.mockResolvedValue(new contact_builder_1.ContactBuilder()
            .withCreatedBy(otherWorkerSid)
            .withTwilioWorkerId(otherWorkerSid)
            .withTaskId('original task')
            .buildContact());
        req.body.taskId = 'transfer task';
        mockIsTwilioTaskTransferTarget.mockResolvedValue(false);
        await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
        expect(twilio_client_1.getClient).toHaveBeenCalledWith({
            accountSid: 'ACtwilio',
        });
        expect(twilio_client_1.isTwilioTaskTransferTarget).toHaveBeenCalledWith(await (0, twilio_client_1.getClient)({ accountSid: accountSid1 }), 'transfer task', 'original task', thisWorkerSid);
        expectToBeBlocked();
    });
};
describe('canPerformEditContactAction', () => {
    test("Request is already permitted - doesn't permit or block", async () => {
        mockRequestMethods.isPermitted.mockReturnValue(true);
        await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
        expectNoop();
    });
    test('Request is not already permitted - looks up contact using contactID parameter', async () => {
        mockRequestMethods.can.mockReturnValue(false);
        mockGetContactById.mockResolvedValue(new contact_builder_1.ContactBuilder().withFinalizedAt(BASELINE_DATE).buildContact());
        await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
        expect(mockGetContactById).toHaveBeenCalledWith(req.hrmAccountId, 'contact1', req);
    });
    describe('finalized contact', function () {
        const validFinalizedContactPatchPayload = {
            rawJson: {
                callType: '',
                categories: {
                    category1: ['value1'],
                },
                childInformation: { a: '1' },
                caseInformation: { a: '1' },
                callerInformation: { a: '1' },
                contactlessTask: {},
            },
            referrals: [
                {
                    resourceId: 'resource1',
                    resourceName: 'Resource 1',
                    referredAt: (0, date_fns_1.subHours)(BASELINE_DATE, 1).toISOString(),
                },
            ],
        };
        beforeEach(() => {
            mockGetContactById.mockResolvedValue(new contact_builder_1.ContactBuilder().withFinalizedAt(BASELINE_DATE).buildContact());
        });
        test('Modifying rawJson / resource referrals and can returns true - permits', async () => {
            req.body = validFinalizedContactPatchPayload;
            mockRequestMethods.can.mockReturnValue(true);
            await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
            expectToBePermitted();
        });
        test('Modifying values other than rawJson / resource referrals and can returns true - blocks', async () => {
            req.body = { ...validFinalizedContactPatchPayload, conversationDuration: 100 };
            mockRequestMethods.can.mockReturnValue(true);
            await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
            expectToBeBlocked();
        });
        test('Modifying rawJson / resource referrals and can returns false - blocks', async () => {
            req.body = validFinalizedContactPatchPayload;
            mockRequestMethods.can.mockReturnValue(false);
            await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
            expectToBeBlocked();
        });
        test('Modifying rawJson / resource referrals and can returns false but EDIT_INPROGRESS_CAN is permitted - blocks', async () => {
            req.body = validFinalizedContactPatchPayload;
            mockRequestMethods.can.mockImplementation((user, action) => action === permissions_1.actionsMaps.contact.EDIT_INPROGRESS_CONTACT);
            await (0, canPerformContactAction_1.canPerformEditContactAction)(req, {}, next);
            expectToBeBlocked();
        });
    });
    describe('draft contact', () => {
        draftContactTests(true);
    });
});
describe('canDisconnectContact', () => {
    test('Request is already permitted - skips authorization', async () => {
        mockRequestMethods.isPermitted.mockReturnValue(true);
        await (0, canPerformContactAction_1.canDisconnectContact)(req, {}, next);
        expectNoop();
    });
    describe('finalized contact', function () {
        let contact = new contact_builder_1.ContactBuilder().withFinalizedAt(BASELINE_DATE).buildContact();
        beforeEach(() => {
            mockGetContactById.mockResolvedValue(contact);
            contact.caseId = '123';
        });
        test('can returns true to permit & case id not set on contact - permits', async () => {
            delete contact.caseId;
            mockRequestMethods.can.mockImplementation((user, action) => action === permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE);
            await (0, canPerformContactAction_1.canDisconnectContact)(req, {}, next);
            expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE, contact);
            expectToBePermitted();
        });
        test('can returns true to permit & case not found to disconnect from - permits', async () => {
            mockGetCase.mockResolvedValue(undefined);
            mockRequestMethods.can.mockImplementation((user, action) => action === permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE);
            await (0, canPerformContactAction_1.canDisconnectContact)(req, {}, next);
            expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE, contact);
            expectToBePermitted();
        });
        test('Can returns true for contact and case checks - permits', async () => {
            const mockCase = {};
            mockGetCase.mockResolvedValue(mockCase);
            mockRequestMethods.can.mockReturnValue(true);
            await (0, canPerformContactAction_1.canDisconnectContact)(req, {}, next);
            expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE, contact);
            expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.case.UPDATE_CASE_CONTACTS, mockCase);
            expectToBePermitted();
        });
        test('Can returns false - blocks', async () => {
            const mockCase = {};
            mockGetCase.mockResolvedValue(mockCase);
            mockRequestMethods.can.mockReturnValue(false);
            await (0, canPerformContactAction_1.canDisconnectContact)(req, {}, next);
            expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE, contact);
            expectToBeBlocked();
        });
        test('Can returns true for contact but false for case - blocks', async () => {
            const mockCase = {};
            mockGetCase.mockResolvedValue(mockCase);
            mockRequestMethods.can.mockImplementation((user, action) => action === permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE);
            await (0, canPerformContactAction_1.canDisconnectContact)(req, {}, next);
            expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.contact.REMOVE_CONTACT_FROM_CASE, contact);
            expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.case.UPDATE_CASE_CONTACTS, mockCase);
            expectToBeBlocked();
        });
    });
    describe('draft contact', () => {
        describe('can update case contacts', draftContactTests(true, async () => {
            mockRequestMethods.can.mockImplementation((user, action) => action === permissions_1.actionsMaps.case.UPDATE_CASE_CONTACTS);
        }));
        describe('cannot update case contacts', draftContactTests(true, async () => {
            mockRequestMethods.can.mockImplementation((user, action) => action !== permissions_1.actionsMaps.case.UPDATE_CASE_CONTACTS &&
                action !== permissions_1.actionsMaps.contact.EDIT_INPROGRESS_CONTACT);
        }));
    });
});
