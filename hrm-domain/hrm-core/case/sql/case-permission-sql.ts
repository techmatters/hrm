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

import { TKCondition } from '../../permissions/rulesMap';
import { selectContactsOwnedCount } from './case-get-sql';

const ALL_OR_NOTHING_CONDITIONS: CaseListCondition[] = ['everyone', 'isSupervisor'];

export type CaseListCondition = Extract<
  TKCondition<'case'>,
  'isCreator' | 'isCaseContactOwner' | 'everyone' | 'isSupervisor' | 'isCaseOpen'
>;

type WhereClauseGeneratingCondition = Exclude<
  CaseListCondition,
  'everyone' | 'isSupervisor'
>;

const conditionWhereClauses: Record<WhereClauseGeneratingCondition, string> = {
  isCreator: `"cases"."twilioWorkerId" = $<twilioWorkerSid>`,
  isCaseContactOwner: `(${selectContactsOwnedCount('twilioWorkerSid')}) > 0`,
  isCaseOpen: `"cases"."status" != 'closed'`,
};

export const listCasesPermissionWhereClause = (
  caseListConditionSets: CaseListCondition[][],
  userIsSupervisor: boolean,
): [clause: string] | [] => {
  const conditionSetClauses: string[] = [];
  const conditionsThatAllowAll: CaseListCondition[] = userIsSupervisor
    ? ALL_OR_NOTHING_CONDITIONS
    : ['everyone'];
  for (const caseListConditionSet of caseListConditionSets) {
    // Any condition set that only has 'everyone' conditions (or isSupervisor conditions for supervisors)
    // means permissions are open regardless of what other conditions there are, so short circuit
    if (
      caseListConditionSet.every(condition => conditionsThatAllowAll.includes(condition))
    ) {
      return [];
    }

    const relevantConditions: WhereClauseGeneratingCondition[] =
      caseListConditionSet.filter(
        condition => !ALL_OR_NOTHING_CONDITIONS.includes(condition),
      ) as WhereClauseGeneratingCondition[];
    if (relevantConditions.length) {
      const conditionClauses = relevantConditions.map(
        condition => conditionWhereClauses[condition],
      );
      conditionSetClauses.push(`(${conditionClauses.join(' AND ')})`);
    }
  }
  return conditionSetClauses.length ? [conditionSetClauses.join(' OR ')] : [];
};
