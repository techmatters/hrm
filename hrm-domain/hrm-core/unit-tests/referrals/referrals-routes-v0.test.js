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
const referral_routes_v0_1 = __importDefault(require("../../referral/referral-routes-v0"));
const referralService_1 = require("../../referral/referralService");
const referralDataAccess_1 = require("../../referral/referralDataAccess");
const date_fns_1 = require("date-fns");
const permissions_1 = require("../../permissions");
const assert_1 = require("assert");
jest.mock('../../permissions', () => ({
    SafeRouter: jest.fn(),
}));
jest.mock('../../referral/referralService', () => ({
    createReferral: jest.fn(),
}));
const mockSafeRouter = permissions_1.SafeRouter;
const mockCreateReferral = referralService_1.createReferral;
beforeEach(() => {
    mockSafeRouter.mockReset();
    mockCreateReferral.mockReset();
});
describe('POST /search', () => {
    const hourAgo = (0, date_fns_1.subHours)(new Date(), 1);
    const validReferral = {
        contactId: '1234',
        resourceId: 'TEST_RESOURCE',
        referredAt: hourAgo.toISOString(),
        resourceName: 'A test referred resource',
    };
    let createReferralRequestHandler;
    const response = { json: jest.fn() };
    const mockResponseJson = response.json;
    beforeEach(() => {
        mockResponseJson.mockReset();
        mockSafeRouter.mockImplementation(() => ({
            post: (path, publicEndpoint, handler) => {
                if (path === '/') {
                    createReferralRequestHandler = handler;
                }
            },
            get: () => { },
        }));
        (0, referral_routes_v0_1.default)();
    });
    test('Passes referral from body and accountSid from request down to model', async () => {
        const innerCreateReferral = jest.fn(() => Promise.resolve(validReferral));
        mockCreateReferral.mockReturnValueOnce(innerCreateReferral);
        await createReferralRequestHandler({
            body: validReferral,
            accountSid: 'AC1',
            hrmAccountId: 'AC1',
        }, response);
        expect(innerCreateReferral).toHaveBeenCalledWith('AC1', validReferral);
        expect(response.json).toHaveBeenCalledWith(validReferral);
    });
    test('referredAt date not in ISO format - throws 400', async () => {
        try {
            await createReferralRequestHandler({
                body: { ...validReferral, referredAt: hourAgo.toString() },
                accountSid: 'AC1',
                hrmAccountId: 'AC1',
            }, response);
        }
        catch (err) {
            expect(err.status).toBe(400);
            return;
        }
        throw new assert_1.AssertionError({ message: 'createReferral handler should have thrown' });
    });
    test('referredAt date missing- throws 400', async () => {
        try {
            await createReferralRequestHandler({
                body: { ...validReferral, referredAt: undefined },
                accountSid: 'AC1',
                hrmAccountId: 'AC1',
            }, response);
        }
        catch (err) {
            expect(err.status).toBe(400);
            return;
        }
        throw new assert_1.AssertionError({ message: 'createReferral handler should have thrown' });
    });
    test('contact id missing- throws 400', async () => {
        try {
            await createReferralRequestHandler({
                body: { ...validReferral, contactId: undefined },
                accountSid: 'AC1',
                hrmAccountId: 'AC1',
            }, response);
        }
        catch (err) {
            expect(err.status).toBe(400);
            return;
        }
        throw new assert_1.AssertionError({ message: 'createReferral handler should have thrown' });
    });
    test('resource id missing- throws 400', async () => {
        try {
            await createReferralRequestHandler({
                body: { ...validReferral, resourceId: undefined },
                accountSid: 'AC1',
                hrmAccountId: 'AC1',
            }, response);
        }
        catch (err) {
            expect(err.status).toBe(400);
            return;
        }
        throw new assert_1.AssertionError({ message: 'createReferral handler should have thrown' });
    });
    test('No name - passes referral from body and accountSid from request down to model', async () => {
        const { resourceName, ...rest } = validReferral;
        const innerCreateReferral = jest.fn(() => Promise.resolve(rest));
        mockCreateReferral.mockReturnValueOnce(innerCreateReferral);
        await createReferralRequestHandler({
            body: rest,
            accountSid: 'AC1',
            hrmAccountId: 'AC1',
        }, response);
        expect(innerCreateReferral).toHaveBeenCalledWith('AC1', rest);
        expect(response.json).toHaveBeenCalledWith(rest);
    });
    test('model throws orphaned referral error - throws 404', async () => {
        const innerCreateReferral = jest.fn(() => Promise.reject(new referralDataAccess_1.OrphanedReferralError(validReferral.contactId, new Error())));
        mockCreateReferral.mockReturnValueOnce(innerCreateReferral);
        try {
            await createReferralRequestHandler({
                body: { ...validReferral, resource: undefined },
                accountSid: 'AC1',
                hrmAccountId: 'AC1',
            }, response);
        }
        catch (err) {
            expect(err.status).toBe(404);
            return;
        }
        throw new assert_1.AssertionError({ message: 'createReferral handler should have thrown' });
    });
    test('model throws duplicate referral error - throws 400', async () => {
        const innerCreateReferral = jest.fn(() => Promise.reject(new referralDataAccess_1.DuplicateReferralError(new Error())));
        mockCreateReferral.mockReturnValueOnce(innerCreateReferral);
        try {
            await createReferralRequestHandler({
                body: { ...validReferral, resource: undefined },
                accountSid: 'AC1',
                hrmAccountId: 'AC1',
            }, response);
        }
        catch (err) {
            expect(err.status).toBe(400);
            return;
        }
        throw new assert_1.AssertionError({ message: 'createReferral handler should have thrown' });
    });
});
