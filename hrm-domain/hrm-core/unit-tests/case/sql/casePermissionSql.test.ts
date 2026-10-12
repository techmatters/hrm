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

import each from 'jest-each';
import {
  CaseListCondition,
  listCasesPermissionWhereClause,
} from '../../../case/sql/casePermissionSql';

const FILTER_ALL_CASES_CLAUSE: [string] = ['1=0'];

describe('listCasesPermissionWhereClause', () => {
  type TestCase = {
    description: string;
    caseListConditionSets: CaseListCondition[][];
    isSupervisor: boolean;
    expected: [string] | [];
  };

  const testCasesWhereSupervisorFlagIsIrrelevant: Omit<TestCase, 'isSupervisor'>[] = [
    {
      description:
        'returns 1=0 to ensure empty set of results when no condition sets are provided',
      caseListConditionSets: [],
      expected: FILTER_ALL_CASES_CLAUSE,
    },
    {
      description:
        'returns 1=0 to ensure empty set of results when only an empty condition set is provided',
      caseListConditionSets: [[]],
      expected: FILTER_ALL_CASES_CLAUSE,
    },
    {
      description:
        'returns 1=0 to ensure empty set of results when only empty condition sets is provided',
      caseListConditionSets: [[], []],
      expected: FILTER_ALL_CASES_CLAUSE,
    },
    {
      description:
        'returns empty array to allow all when a set with only an everyone condition is provided',
      caseListConditionSets: [['everyone']],
      expected: [],
    },
    {
      description:
        'returns empty array to allow all when a set with only an everyone condition is provided alongside other fully blocking',
      caseListConditionSets: [['everyone'], []],
      expected: [],
    },
    {
      description:
        'returns empty array to allow all when a set with only an everyone condition is provided alongside other more restrictive ones',
      caseListConditionSets: [['everyone'], ['isCaseOpen', 'isCreator']],
      expected: [],
    },
    {
      description:
        'returns single where clause when a single condition set with a single filtering condition is provided',
      caseListConditionSets: [['isCaseOpen']],
      expected: [`(("cases"."status" != 'closed'))`],
    },
    {
      description:
        "returns single where clause when a single condition set with a single filtering condition alongside an 'everyone' condition is provided",
      caseListConditionSets: [['isCaseOpen', 'everyone']],
      expected: [`(("cases"."status" != 'closed'))`],
    },
    {
      description:
        'returns an AND where clause when a single condition set with multiple filtering conditions is provided',
      caseListConditionSets: [['isCaseOpen', 'isCreator', 'isCaseContactOwner']],
      expected: [
        `(("cases"."status" != 'closed' AND "cases"."twilioWorkerId" = $<twilioWorkerSid> AND (SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<twilioWorkerSid>) > 0))`,
      ],
    },
    {
      description:
        'returns an OR where clause when multiple condition sets with a single filtering conditions are provided',
      caseListConditionSets: [['isCaseOpen'], ['isCreator'], ['isCaseContactOwner']],
      expected: [
        `(("cases"."status" != 'closed') OR ("cases"."twilioWorkerId" = $<twilioWorkerSid>) OR ((SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<twilioWorkerSid>) > 0))`,
      ],
    },
    {
      description:
        'returns AND clauses nested in an OR where clause when multiple condition sets with multiple filtering conditions are provided',
      caseListConditionSets: [['isCaseOpen', 'isCreator'], ['isCaseContactOwner']],
      expected: [
        `(("cases"."status" != 'closed' AND "cases"."twilioWorkerId" = $<twilioWorkerSid>) OR ((SELECT COUNT(*) AS "contactsOwnedByUserCount" 
   FROM "Contacts" 
   WHERE "caseId" = cases.id AND "accountSid" = cases."accountSid" AND "twilioWorkerId" = $<twilioWorkerSid>) > 0))`,
      ],
    },
  ];

  const testCases: TestCase[] = [
    ...testCasesWhereSupervisorFlagIsIrrelevant.flatMap(testCase =>
      [true, false].map<TestCase>(isSupervisor => ({
        ...testCase,
        isSupervisor,
        description: `${testCase.description}, isSupervisor flag set to ${isSupervisor}`,
      })),
    ),
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
      description:
        'set with single isSupervisor condition negates filtering conditions when the user is a supervisor',
      caseListConditionSets: [['isCaseOpen'], ['isSupervisor']],
      isSupervisor: true,
      expected: [],
    },
    {
      description:
        'set with single isSupervisor condition has no effect when the user is not a supervisor',
      caseListConditionSets: [['isCaseOpen'], ['isSupervisor']],
      isSupervisor: false,
      expected: [`(("cases"."status" != 'closed'))`],
    },
    {
      description:
        'set including isSupervisor condition & filtering conditions has no effect on filtering conditions when the user is a supervisor',
      caseListConditionSets: [['isCaseOpen', 'isSupervisor']],
      isSupervisor: true,
      expected: [`(("cases"."status" != 'closed'))`],
    },
    {
      description:
        'set including isSupervisor condition & filtering conditions blocks all when the user is not a supervisor',
      caseListConditionSets: [['isCaseOpen', 'isSupervisor']],
      isSupervisor: false,
      expected: FILTER_ALL_CASES_CLAUSE,
    },
  ];

  each(testCases).test(
    '$description',
    ({ isSupervisor, caseListConditionSets, expected }: TestCase) => {
      expect(
        listCasesPermissionWhereClause(caseListConditionSets, isSupervisor),
      ).toStrictEqual(expected);
    },
  );
});
