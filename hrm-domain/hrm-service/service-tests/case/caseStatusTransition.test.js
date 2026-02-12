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
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@tech-matters/testing");
const mocks = __importStar(require("../mocks"));
const caseApi = __importStar(require("@tech-matters/hrm-core/case/caseService"));
const caseService_1 = require("@tech-matters/hrm-core/case/caseService");
const dbConnection_1 = require("../dbConnection");
const date_fns_1 = require("date-fns");
const case_status_transition_1 = require("@tech-matters/case-status-transition");
const mocks_1 = require("../mocks");
const setupServiceTest_1 = require("../setupServiceTest");
const { case1, workerSid } = mocks;
const fixStatusUpdatedAt = async (caseObj, statusUpdatedAt) => dbConnection_1.db.task(async (t) => {
    await t.none(`UPDATE "Cases" SET "statusUpdatedAt" = $<statusUpdatedAt> WHERE id = $<id> AND "accountSid" = $<accountSid>`, { statusUpdatedAt, id: caseObj.id, accountSid: caseObj.accountSid });
});
const getUpdatedCases = async (before) => {
    const updatedCaseEntries = await Promise.all(Object.entries(before).map(async ([key, caseObj]) => {
        return [key, await (0, caseService_1.getCase)(caseObj.id, caseObj.accountSid, mocks_1.ALWAYS_CAN)];
    }));
    return Object.fromEntries(updatedCaseEntries);
};
(0, setupServiceTest_1.setupServiceTests)(workerSid);
describe('Single Rule', () => {
    const cases = {};
    beforeAll(async () => {
        jest.setTimeout(20000);
        const mockttp = await testing_1.mockingProxy.mockttpServer();
        const mockRuleSet = [
            [
                'AC1',
                [
                    {
                        startingStatus: 'status1',
                        targetStatus: 'status2',
                        timeInStatusInterval: '1 day',
                        description: 'test rule 1',
                    },
                ],
            ],
        ];
        await (0, testing_1.mockSsmParameters)(mockttp, [
            ...mockRuleSet.map(([accountSid, rules]) => ({
                name: `/test/xx-fake-1/hrm/scheduled-task/case-status-transition-rules/${accountSid}`,
                valueGenerator: () => JSON.stringify(rules),
            })),
            {
                name: `/test/xx-other-1/hrm/scheduled-task/case-status-transition-rules/AC1`,
                valueGenerator: () => JSON.stringify([
                    {
                        startingStatus: 'not status1',
                        targetStatus: 'not status2',
                        timeInStatusInterval: '1 hour',
                        description: 'test rule for wrong region - should not be applied',
                    },
                ]),
            },
        ]);
    });
    const validDateForTransition = (0, date_fns_1.subDays)(new Date(), 2);
    const tooRecentDateForTransition = (0, date_fns_1.subHours)(new Date(), 20);
    beforeEach(async () => {
        cases.validForUpdate = await caseApi.createCase({ ...case1, status: 'status1' }, 'AC1', workerSid, undefined, true);
        cases.validStatusButTooRecent = await caseApi.createCase({ ...case1, status: 'status1' }, 'AC1', workerSid, undefined, true);
        cases.validUpdatedTimeButIncorrectStatus = await caseApi.createCase({ ...case1, status: 'not status1' }, 'AC1', workerSid, undefined, true);
        cases.validForUpdateButWrongAccount = await caseApi.createCase({ ...case1, status: 'status1' }, 'ACnot1', workerSid, undefined, true);
        await Promise.all([
            fixStatusUpdatedAt(cases.validStatusButTooRecent, tooRecentDateForTransition),
            fixStatusUpdatedAt(cases.validUpdatedTimeButIncorrectStatus, validDateForTransition),
            fixStatusUpdatedAt(cases.validForUpdate, validDateForTransition),
            fixStatusUpdatedAt(cases.validForUpdateButWrongAccount, validDateForTransition),
        ]);
    });
    test('Should update status for qualifying cases only', async () => {
        await (0, case_status_transition_1.transitionCaseStatuses)();
        const { validForUpdate, validStatusButTooRecent, validForUpdateButWrongAccount, validUpdatedTimeButIncorrectStatus, } = await getUpdatedCases(cases);
        expect(validForUpdate.status).toEqual('status2');
        expect((0, date_fns_1.isAfter)((0, date_fns_1.parseISO)(validForUpdate.statusUpdatedAt), (0, date_fns_1.subMinutes)(new Date(), 5))).toBeTruthy();
        expect(validForUpdate.statusUpdatedBy).toBe('test rule 1');
        expect(validStatusButTooRecent.status).toEqual('status1');
        expect(validStatusButTooRecent.statusUpdatedAt).toParseAsDate(tooRecentDateForTransition);
        expect(validStatusButTooRecent.statusUpdatedBy).toBeNull();
        expect(validUpdatedTimeButIncorrectStatus.status).toEqual('not status1');
        expect(validUpdatedTimeButIncorrectStatus.statusUpdatedAt).toParseAsDate(validDateForTransition);
        expect(validUpdatedTimeButIncorrectStatus.statusUpdatedBy).toBeNull();
        expect(validForUpdateButWrongAccount.status).toEqual('status1');
        expect(validForUpdateButWrongAccount.statusUpdatedAt).toParseAsDate(validDateForTransition);
        expect(validForUpdateButWrongAccount.statusUpdatedBy).toBeNull();
    });
});
