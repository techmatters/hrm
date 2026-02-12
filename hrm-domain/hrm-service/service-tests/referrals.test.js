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
const mocks = __importStar(require("./mocks"));
const dbConnection_1 = require("./dbConnection");
const server_1 = require("./server");
const date_fns_1 = require("date-fns");
const mocks_1 = require("./mocks");
const jest_each_1 = __importDefault(require("jest-each"));
const setupServiceTest_1 = require("./setupServiceTest");
const { accountSid } = mocks;
const referralExistsInDb = async (referral) => {
    const record = await dbConnection_1.db.task(conn => conn.oneOrNone(`SELECT * FROM "Referrals" AS r 
              WHERE r."accountSid" = $<accountSid> 
              AND r."contactId" = $<contactId> 
              AND r."resourceId" = $<resourceId> 
              AND r."referredAt" = $<referredAt>`, { ...referral, accountSid }));
    return Boolean(record);
};
let existingContactId, otherExistingContactId;
const { request } = (0, setupServiceTest_1.setupServiceTests)();
beforeEach(async () => {
    const responses = await Promise.all([
        request.post(`/v0/accounts/${accountSid}/contacts`).set(server_1.headers).send(mocks_1.contact1),
        request.post(`/v0/accounts/${accountSid}/contacts`).set(server_1.headers).send(mocks_1.contact2),
    ]);
    [existingContactId, otherExistingContactId] = responses.map(r => r.body.id);
    console.log('Contact IDs for test:', existingContactId, otherExistingContactId);
});
const route = `/v0/accounts/${accountSid}/referrals`;
describe('POST /', () => {
    const hourAgo = (0, date_fns_1.subHours)(new Date(), 1);
    let validBody;
    beforeEach(() => {
        validBody = {
            contactId: existingContactId,
            resourceId: 'TEST_RESOURCE',
            referredAt: hourAgo.toISOString(),
            resourceName: 'A test referred resource',
        };
    });
    test('No auth headers - should return 401', async () => {
        const response = await request.post(route).send(validBody);
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
    });
    test('Contact ID exists - creates referral and returns it back', async () => {
        const response = await request.post(route).set(server_1.headers).send(validBody);
        expect(response.status).toBe(200);
        expect(response.body).toStrictEqual(validBody);
        expect(await referralExistsInDb(validBody)).toBe(true);
    });
    test('Contact ID does not exist - returns 404', async () => {
        const response = await request
            .post(route)
            .set(server_1.headers)
            .send({ ...validBody, contactId: '-1' });
        expect(response.status).toBe(404);
        expect(await referralExistsInDb({ ...validBody, contactId: '-1' })).toBe(false);
    });
    test('Referral with same contact ID, resource ID and referredAt date already exists - return 400', async () => {
        const firstResponse = await request.post(route).set(server_1.headers).send(validBody);
        expect(firstResponse.status).toBe(200);
        expect(await referralExistsInDb(validBody)).toBe(true);
        const secondResponse = await request.post(route).set(server_1.headers).send(validBody);
        expect(secondResponse.status).toBe(400);
        expect(await referralExistsInDb(validBody)).toBe(true);
    });
    // secondBodyChanges needs to be a func otherwise otherExistingContactId is evaluated too soon.
    (0, jest_each_1.default)([
        {
            secondBodyChanges: () => ({ referredAt: (0, date_fns_1.addSeconds)(hourAgo, 10).toISOString() }),
            changeDescription: 'referredAt',
        },
        {
            secondBodyChanges: () => ({ contactId: otherExistingContactId }),
            changeDescription: 'contactId',
        },
        {
            secondBodyChanges: () => ({ resourceId: 'OTHER_TEST_RESOURCE' }),
            changeDescription: 'resourceId',
        },
    ]).test('Referral which duplicates an existing one but with different $changeDescription creates another record', async ({ secondBodyChanges }) => {
        const firstResponse = await request.post(route).set(server_1.headers).send(validBody);
        expect(firstResponse.status).toBe(200);
        const secondBody = { ...validBody, ...secondBodyChanges() };
        const secondResponse = await request.post(route).set(server_1.headers).send(secondBody);
        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body).toStrictEqual(secondBody);
        expect(await referralExistsInDb(secondBody)).toBe(true);
    });
    (0, jest_each_1.default)([
        {
            missingField: 'referredAt',
        },
        {
            missingField: 'contactId',
        },
        {
            missingField: 'resourceId',
        },
    ]).test('Referral has no $missingField returns a 400', async ({ missingField, }) => {
        const { [missingField]: removed, ...secondBody } = validBody;
        const response = await request.post(route).set(server_1.headers).send(secondBody);
        expect(response.status).toBe(400);
    });
});
