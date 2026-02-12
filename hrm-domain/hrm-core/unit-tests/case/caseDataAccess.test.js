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
const mockCases_1 = require("./mockCases");
const mockDb_1 = require("../mockDb");
const caseDb = __importStar(require("../../case/caseDataAccess"));
const jest_each_1 = __importDefault(require("jest-each"));
const caseSearchSql_1 = require("../../case/sql/caseSearchSql");
const testing_1 = require("@tech-matters/testing");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const permissions_1 = require("../../permissions");
const caseDataAccess_1 = require("../../case/caseDataAccess");
const lodash_1 = require("lodash");
const accountSid = 'ACCOUNT_SID';
const workerSid = 'WK-twilio-worker-id';
const user = (0, twilio_worker_auth_1.newTwilioUser)('ACxx', 'WKxx', ['supervisor']);
let conn;
const caseId = 42;
beforeEach(() => {
    conn = (0, mockDb_1.mockConnection)();
    (0, mockDb_1.mockTask)(conn, accountSid);
});
describe('getById', () => {
    test('get existing case returns case record matching id & account', async () => {
        const caseFromDB = (0, mockCases_1.createMockCaseRecord)({
            id: caseId,
            helpline: 'helpline',
            status: 'open',
            info: {},
            twilioWorkerId: workerSid,
        });
        const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(caseFromDB);
        const result = await caseDb.getById(caseId, accountSid, user);
        expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), expect.objectContaining({ accountSid, caseId }));
        expect(result).toStrictEqual(caseFromDB);
    });
    test('get non existing case returns undefined', async () => {
        const oneOrNoneSpy = jest.spyOn(conn, 'oneOrNone').mockResolvedValue(undefined);
        const result = await caseDb.getById(caseId, accountSid, user);
        expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('"Cases"'), expect.objectContaining({ accountSid, caseId }));
        expect(result).not.toBeDefined();
    });
});
describe('createCase', () => {
    test('creates new record and returns created record in DB, with assigned ID.', async () => {
        const caseFromDB = (0, mockCases_1.createMockCaseInsert)({
            helpline: 'helpline',
            status: 'open',
            twilioWorkerId: workerSid,
        });
        const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue({ ...caseFromDB, id: 1337 });
        const result = await caseDb.create(caseFromDB);
        const insertSql = (0, testing_1.getSqlStatement)(oneSpy, -1);
        const validInsertions = (0, lodash_1.pick)(caseFromDB, caseDataAccess_1.VALID_CASE_CREATE_FIELDS);
        (0, testing_1.expectValuesInSql)(insertSql, {
            ...validInsertions,
            createdAt: expect.anything(),
            updatedAt: expect.anything(),
        });
        expect(result).toStrictEqual({ ...caseFromDB, id: 1337 });
    });
});
describe('search', () => {
    const openViewPermissions = permissions_1.rulesMap.open.viewCase;
    describe('query parameters', () => {
        const testCases = [
            {
                description: 'should use a default limit and offset 0 when neither specified',
                filters: { helplines: ['fakeHelpline'] },
                expectedDbParameters: { limit: expect.any(Number), offset: 0 },
                expectedInSql: ['"id" DESC'],
            },
            {
                description: 'should use a specified limit and offset 0 when only limit is specified',
                filters: { helplines: ['fakeHelpline'] },
                listConfig: { limit: '45' },
                expectedDbParameters: { limit: 45, offset: 0 },
                expectedInSql: ['"id" DESC'],
            },
            {
                description: 'should use a default limit specified and offset when only offset is specified',
                filters: { helplines: ['fakeHelpline'] },
                listConfig: { offset: '30' },
                expectedDbParameters: { limit: expect.any(Number), offset: 30 },
                expectedInSql: ['"id" DESC'],
            },
            {
                description: 'should use a specified limit and offset when both are present',
                filters: { helplines: ['fakeHelpline'] },
                listConfig: { limit: '45', offset: '30' },
                expectedDbParameters: { limit: 45, offset: 30 },
                expectedInSql: ['"id" DESC'],
            },
            {
                description: 'should use a default limit and/or offset when either are NaN',
                filters: { helplines: ['fakeHelpline'] },
                listConfig: { limit: 'NaN', offset: 'NaN' },
                expectedDbParameters: { limit: expect.any(Number), offset: 0 },
                expectedInSql: ['"id" DESC'],
            },
            {
                description: "should generate SQL without helpline filter if one isn't set",
                listConfig: { limit: '100', offset: '25' },
                expectedDbParameters: { limit: 100, offset: 25 },
                expectedInSql: ['"id" DESC'],
            },
            {
                description: 'should generate SQL with order by clause',
                listConfig: {
                    limit: '100',
                    offset: '25',
                    sortBy: caseSearchSql_1.OrderByColumn.LABEL,
                    sortDirection: 'ASC',
                },
                expectedDbParameters: { limit: 100, offset: 25 },
                expectedInSql: ['"id" DESC', '"label" ASC NULLS LAST'],
            },
            {
                description: 'should ignore unrecognised sortBy columns',
                listConfig: {
                    limit: '100',
                    offset: '25',
                    sortBy: 'jimmyjab',
                    sortDirection: 'ASC',
                },
                expectedDbParameters: { limit: 100, offset: 25 },
                expectedInSql: ['"id" DESC'],
                notExpectedInSql: ['jimmyjab'],
            },
            {
                description: "should use default 'id' column for ordering if order specified but no column",
                listConfig: {
                    limit: '100',
                    offset: '25',
                    sortDirection: 'ASC',
                },
                expectedDbParameters: { limit: 100, offset: 25 },
                expectedInSql: ['"id" DESC', '"id" ASC NULLS LAST,'],
            },
            {
                description: 'should use default DESC NULLS LAST sort if only sort column is specified',
                listConfig: {
                    limit: '100',
                    offset: '25',
                    sortBy: caseSearchSql_1.OrderByColumn.LABEL,
                },
                expectedDbParameters: { limit: 100, offset: 25 },
                expectedInSql: ['"id" DESC', '"label" DESC NULLS LAST'],
            },
        ];
        (0, jest_each_1.default)(testCases).test('$description', async ({ listConfig = {}, filters = {}, expectedDbParameters, expectedInSql = [], notExpectedInSql = [], }) => {
            const dbResult = [
                { ...(0, mockCases_1.createMockCaseRecord)({ id: 2 }), totalCount: 1337 },
                { ...(0, mockCases_1.createMockCaseRecord)({ id: 1 }), totalCount: 1337 },
            ];
            const anySpy = jest.spyOn(conn, 'any').mockResolvedValue(dbResult);
            const result = await caseDb.list(user, permissions_1.rulesMap.open.viewCase, listConfig, accountSid, null, filters);
            expect(anySpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), expect.objectContaining({ ...expectedDbParameters, accountSid }));
            const sql = (0, testing_1.getSqlStatement)(anySpy);
            expectedInSql.forEach(expected => {
                expect(sql).toContain(expected);
            });
            notExpectedInSql.forEach(notExpected => {
                expect(sql).not.toContain(notExpected);
            });
            expect(result.count).toEqual(1337);
            expect(result.cases).toStrictEqual(dbResult);
        });
    });
    (0, jest_each_1.default)([
        {
            description: 'should return case without contacts when a case has none connected',
            filters: { helplines: ['fakeHelpline'] },
            expectedDbParameters: { limit: expect.any(Number), offset: 0 },
            dbResult: [
                {
                    id: caseId,
                    helpline: 'helpline',
                    status: 'open',
                    info: {},
                    twilioWorkerId: 'WK-twilio-worker-id',
                    totalCount: 1337,
                },
            ],
        },
        {
            description: 'should return connected contacts when a case has them',
            filters: { helplines: ['fakeHelpline'] },
            expectedDbParameters: { limit: expect.any(Number), offset: 0 },
            dbResult: [
                {
                    id: caseId,
                    helpline: 'helpline',
                    status: 'open',
                    info: {},
                    twilioWorkerId: 'WK-twilio-worker-id',
                    connectedContacts: [
                        {
                            rawJson: {
                                childInformation: { name: { firstName: 'name', lastName: 'last' } },
                                caseInformation: {
                                    categories: {
                                        cat1: { sub1: false, sub2: true },
                                        cat2: { sub2: false, sub4: false },
                                    },
                                },
                            },
                        },
                    ],
                    totalCount: 1337,
                },
            ],
        },
    ]).test('$description', async ({ filters = {}, listConfig = {}, expectedDbParameters, dbResult, expectedResult = dbResult, }) => {
        const anySpy = jest.spyOn(conn, 'any').mockResolvedValue(dbResult);
        const result = await caseDb.list(user, openViewPermissions, listConfig, accountSid, null, filters);
        expect(anySpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), expect.objectContaining({
            ...expectedDbParameters,
            accountSid,
        }));
        const statementExecuted = (0, testing_1.getSqlStatement)(anySpy);
        expect(statementExecuted).toContain('Contacts');
        expect(result.count).toEqual(1337);
        expect(result.cases).toStrictEqual(expectedResult);
    });
});
describe('delete', () => {
    test('returns deleted value if something at the specified ID exists to delete', async () => {
        const caseFromDB = (0, mockCases_1.createMockCaseRecord)({});
        const oneOrNoneSpy = jest
            .spyOn((0, mockDb_1.getMockAccountDb)(accountSid), 'oneOrNone')
            .mockResolvedValue(caseFromDB);
        const result = await caseDb.deleteById(caseId, accountSid);
        expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), [
            accountSid,
            caseId,
        ]);
        expect(result).toStrictEqual(caseFromDB);
    });
    test('returns nothing if nothing at the specified ID exists to delete', async () => {
        const oneOrNoneSpy = jest
            .spyOn((0, mockDb_1.getMockAccountDb)(accountSid), 'oneOrNone')
            .mockResolvedValue(undefined);
        const result = await caseDb.deleteById(caseId, accountSid);
        expect(oneOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('Cases'), [
            accountSid,
            caseId,
        ]);
        expect(result).not.toBeDefined();
    });
});
