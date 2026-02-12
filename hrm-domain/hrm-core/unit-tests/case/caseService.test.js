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
const caseDb = __importStar(require("../../case/caseDataAccess"));
const caseApi = __importStar(require("../../case/caseService"));
const caseSectionApi = __importStar(require("../../case/caseSection/caseSectionService"));
const mockCases_1 = require("./mockCases");
const jest_each_1 = __importDefault(require("jest-each"));
require("@tech-matters/testing/expectToParseAsDate");
const mocks_1 = require("../mocks");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const permissions_1 = require("../../permissions");
const entityChangeNotify = __importStar(require("../../notifications/entityChangeNotify"));
const publishCaseChangeNotificationSpy = jest
    .spyOn(entityChangeNotify, 'publishCaseChangeNotification')
    .mockImplementation(() => Promise.resolve('Ok'));
jest.mock('../../case/caseDataAccess');
const twilioWorkerId = 'WK-twilio-worker-id';
test('create case', async () => {
    const caseToBeCreated = (0, mockCases_1.createMockCase)({
        helpline: 'helpline',
        status: 'open',
        twilioWorkerId: 'WK-client-assigned-twilio-worker-id',
        createdBy: 'WK Fake news', // Overwritten by workerSid for User
        accountSid: 'AC-wrong-account-sid', // Overwritten by accountSid for User
        info: {},
    });
    const expectedCaseDbParameter = {
        ...caseToBeCreated,
        accountSid: mocks_1.accountSid,
        createdBy: mocks_1.workerSid,
        createdAt: expect.any(String), // current timestamp
        updatedAt: expect.any(String), // current timestamp
        info: {},
    };
    // @ts-ignore
    delete expectedCaseDbParameter.id;
    const createdCaseRecord = {
        ...expectedCaseDbParameter,
        id: 1,
        accountSid: mocks_1.accountSid,
    };
    const createSpy = jest.spyOn(caseDb, 'create').mockResolvedValue(createdCaseRecord);
    // const getByIdSpy =
    jest.spyOn(caseDb, 'getById').mockResolvedValueOnce(createdCaseRecord);
    jest
        .spyOn(caseSectionApi, 'getMultipleCaseTimelines')
        .mockResolvedValue({ count: 0, timelines: {} });
    const createdCase = await caseApi.createCase(caseToBeCreated, mocks_1.accountSid, mocks_1.workerSid);
    // any worker & account specified on the object should be overwritten with the ones from the user
    expect(createSpy).toHaveBeenCalledWith(expectedCaseDbParameter);
    expect(createdCase).toStrictEqual({
        ...caseToBeCreated,
        id: '1',
        createdBy: mocks_1.workerSid,
        accountSid: mocks_1.accountSid,
        precalculatedPermissions: {
            userOwnsContact: false,
        },
    });
    await new Promise(process.nextTick);
    expect(publishCaseChangeNotificationSpy).toHaveBeenCalled();
});
describe('searchCases', () => {
    const caseId = 1;
    const caseObject = (0, mockCases_1.createMockCase)({
        id: caseId.toString(),
        helpline: 'helpline',
        accountSid: mocks_1.accountSid,
        status: 'open',
        info: {},
        twilioWorkerId,
    });
    const caseRecord = (0, mockCases_1.createMockCaseRecord)({
        accountSid: mocks_1.accountSid,
        id: caseId,
        helpline: 'helpline',
        status: 'open',
        info: {},
        twilioWorkerId,
    });
    (0, jest_each_1.default)([
        {
            description: 'list cases (without contacts) - creates empty categories',
            filterParameters: { helpline: 'helpline' },
            expectedDbFilters: { helplines: ['helpline'] },
            casesFromDb: [caseRecord],
            expectedCases: [
                {
                    ...caseObject,
                    precalculatedPermissions: {
                        userOwnsContact: false,
                    },
                },
            ],
        },
        {
            description: 'list cases without helpline - sends offset & limit to db layer but no helpline',
            listConfig: { offset: 30, limit: 45 },
            casesFromDb: [caseRecord],
            expectedCases: [
                {
                    ...caseObject,
                    precalculatedPermissions: {
                        userOwnsContact: false,
                    },
                },
            ],
        },
    ]).test('$description', async ({ casesFromDb, expectedCases, listConfig = {}, search = {}, filterParameters = {}, expectedDbSearchCriteria = {}, expectedDbFilters = {}, }) => {
        const expected = { cases: expectedCases, count: 1337 };
        const searchSpy = jest
            .spyOn(caseDb, 'list')
            .mockResolvedValue({ cases: casesFromDb, count: 1337 });
        const result = await caseApi.listCases(mocks_1.accountSid, listConfig, search, filterParameters, 
        // {closedCases, counselor, filters: {}, helpline},
        {
            can: () => true,
            user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, mocks_1.workerSid, []),
            permissionRules: permissions_1.rulesMap.open,
        });
        const user = { ...(0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, mocks_1.workerSid, []), isSupervisor: false };
        expect(searchSpy).toHaveBeenCalledWith(user, [['everyone']], listConfig ?? {}, mocks_1.accountSid, expectedDbSearchCriteria, {
            includeOrphans: true,
            excludedStatuses: [],
            counsellors: undefined,
            ...expectedDbFilters,
        });
        expect(result).toStrictEqual(expected);
        searchSpy.mockReset();
    });
});
describe('search cases permissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    (0, jest_each_1.default)([
        {
            description: 'Supervisor can view others cases',
            isSupervisor: true,
            canOnlyViewOwnCases: false,
            counsellors: ['any-worker-sid'],
        },
        {
            description: 'Agent can view others cases',
            isSupervisor: false,
            canOnlyViewOwnCases: false,
            counsellors: ['any-worker-sid'],
        },
        {
            description: 'Agent cannot view others cases',
            isSupervisor: false,
            canOnlyViewOwnCases: true,
            counsellors: ['any-worker-sid'],
        },
        {
            description: 'Agent can view own cases',
            isSupervisor: false,
            canOnlyViewOwnCases: true,
            counsellors: mocks_1.workerSid,
            overriddenCounsellors: [mocks_1.workerSid],
        },
        {
            description: 'Agent defaults to own cases when no counselor specified',
            isSupervisor: false,
            canOnlyViewOwnCases: true,
            counsellors: undefined,
        },
    ]).test('$description', async ({ isSupervisor, canOnlyViewOwnCases, counsellors }) => {
        const filterParameters = {
            helpline: 'helpline',
            closedCases: true,
            filters: {
                counsellors,
            },
        };
        const viewOwnCasesRulesFile = {
            ...permissions_1.rulesMap.open,
            ['viewCase']: [['isCreator']],
        };
        const limitOffset = { limit: '10', offset: '0' };
        const can = () => true;
        const roles = [];
        const user = {
            ...(0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, mocks_1.workerSid, roles),
            isSupervisor: isSupervisor,
        };
        const reqData = {
            can,
            user,
            permissionRules: canOnlyViewOwnCases ? viewOwnCasesRulesFile : permissions_1.rulesMap.open,
        };
        const searchSpy = jest
            .spyOn(caseDb, 'list')
            .mockResolvedValue({ cases: [], count: 0 });
        await caseApi.listCases(mocks_1.accountSid, limitOffset, null, filterParameters, reqData);
        expect(searchSpy).toHaveBeenCalledWith(user, canOnlyViewOwnCases ? [['isCreator']] : [['everyone']], limitOffset, mocks_1.accountSid, null, filterParameters.filters);
    });
});
