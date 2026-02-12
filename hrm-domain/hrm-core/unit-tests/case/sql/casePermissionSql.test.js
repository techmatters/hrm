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
const jest_each_1 = __importDefault(require("jest-each"));
const casePermissionSql_1 = require("../../../case/sql/casePermissionSql");
const FILTER_ALL_CASES_CLAUSE = ['1=0'];
describe('listCasesPermissionWhereClause', () => {
    const testCasesWhereSupervisorFlagIsIrrelevant = [
        {
            description: 'returns 1=0 to ensure empty set of results when no condition sets are provided',
            caseListConditionSets: [],
            expected: FILTER_ALL_CASES_CLAUSE,
        },
        {
            description: 'returns 1=0 to ensure empty set of results when only an empty condition set is provided',
            caseListConditionSets: [[]],
            expected: FILTER_ALL_CASES_CLAUSE,
        },
        {
            description: 'returns 1=0 to ensure empty set of results when only empty condition sets is provided',
            caseListConditionSets: [[], []],
            expected: FILTER_ALL_CASES_CLAUSE,
        },
        {
            description: 'returns empty array to allow all when a set with only an everyone condition is provided',
            caseListConditionSets: [['everyone']],
            expected: [],
        },
        {
            description: 'returns empty array to allow all when a set with only an everyone condition is provided alongside other fully blocking',
            caseListConditionSets: [['everyone'], []],
            expected: [],
        },
        {
            description: 'returns empty array to allow all when a set with only an everyone condition is provided alongside other more restrictive ones',
            caseListConditionSets: [['everyone'], ['isCaseOpen', 'isCreator']],
            expected: [],
        },
        {
            description: 'returns single where clause when a single condition set with a single filtering condition is provided',
            caseListConditionSets: [['isCaseOpen']],
            expected: [`(("cases"."status" != 'closed'))`],
        },
        {
            description: "returns single where clause when a single condition set with a single filtering condition alongside an 'everyone' condition is provided",
            caseListConditionSets: [['isCaseOpen', 'everyone']],
            expected: [`(("cases"."status" != 'closed'))`],
        },
        {
            description: 'returns an AND where clause when a single condition set with multiple filtering conditions is provided',
            caseListConditionSets: [['isCaseOpen', 'isCreator', 'isCaseContactOwner']],
            expected: [
                `(("cases"."status" != 'closed' AND "cases"."twilioWorkerId" = $<twilioWorkerSid> AND (SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<twilioWorkerSid>) > 0))`,
            ],
        },
        {
            description: 'returns an OR where clause when multiple condition sets with a single filtering conditions are provided',
            caseListConditionSets: [['isCaseOpen'], ['isCreator'], ['isCaseContactOwner']],
            expected: [
                `(("cases"."status" != 'closed') OR ("cases"."twilioWorkerId" = $<twilioWorkerSid>) OR ((SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<twilioWorkerSid>) > 0))`,
            ],
        },
        {
            description: 'returns AND clauses nested in an OR where clause when multiple condition sets with multiple filtering conditions are provided',
            caseListConditionSets: [['isCaseOpen', 'isCreator'], ['isCaseContactOwner']],
            expected: [
                `(("cases"."status" != 'closed' AND "cases"."twilioWorkerId" = $<twilioWorkerSid>) OR ((SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<twilioWorkerSid>) > 0))`,
            ],
        },
    ];
    const testCases = [
        ...testCasesWhereSupervisorFlagIsIrrelevant.flatMap(testCase => [true, false].map(isSupervisor => ({
            ...testCase,
            isSupervisor,
            description: `${testCase.description}, isSupervisor flag set to ${isSupervisor}`,
        }))),
        {
            description: 'single isSupervisor condition allows all for supervisor users',
            caseListConditionSets: [['isSupervisor']],
            isSupervisor: true,
            expected: [],
        },
        {
            description: 'single isSupervisor condition blocks all for non supervisor users',
            caseListConditionSets: [['isSupervisor']],
            isSupervisor: false,
            expected: FILTER_ALL_CASES_CLAUSE,
        },
        {
            description: 'set with single isSupervisor condition negates filtering conditions when the user is a supervisor',
            caseListConditionSets: [['isCaseOpen'], ['isSupervisor']],
            isSupervisor: true,
            expected: [],
        },
        {
            description: 'set with single isSupervisor condition has no effect when the user is not a supervisor',
            caseListConditionSets: [['isCaseOpen'], ['isSupervisor']],
            isSupervisor: false,
            expected: [`(("cases"."status" != 'closed'))`],
        },
        {
            description: 'set including isSupervisor condition & filtering conditions has no effect on filtering conditions when the user is a supervisor',
            caseListConditionSets: [['isCaseOpen', 'isSupervisor']],
            isSupervisor: true,
            expected: [`(("cases"."status" != 'closed'))`],
        },
        {
            description: 'set including isSupervisor condition & filtering conditions blocks all when the user is not a supervisor',
            caseListConditionSets: [['isCaseOpen', 'isSupervisor']],
            isSupervisor: false,
            expected: FILTER_ALL_CASES_CLAUSE,
        },
    ];
    (0, jest_each_1.default)(testCases).test('$description', ({ isSupervisor, caseListConditionSets, expected }) => {
        expect((0, casePermissionSql_1.listCasesPermissionWhereClause)(caseListConditionSets, isSupervisor)).toStrictEqual(expected);
    });
});
