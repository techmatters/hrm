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

import { isTimeBasedCondition, type TKCondition } from '../rulesMap';
import type { PermissionFilterGenerators, TKindPermissionTarget } from './types';
import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { FILTER_ALL_CLAUSE } from '@tech-matters/hrm-search-config';

export type ConditionWhereClausesES<TKind extends TKindPermissionTarget> =
  PermissionFilterGenerators<TKind, QueryDslQueryContainer>;

export const listPermissionWhereClause = <TKind extends TKindPermissionTarget>({
  conditionWhereClauses,
  listConditionSets,
  user,
}: {
  listConditionSets: TKCondition<TKind>[][];
  conditionWhereClauses: ConditionWhereClausesES<TKind>;
  user: TwilioUser;
}): QueryDslQueryContainer[][] => {
  type ListCondition = TKCondition<TKind>;
  const ALL_OR_NOTHING_CONDITIONS: ListCondition[] = [
    'everyone',
    'isSupervisor',
    'nobody',
  ];
  type WhereClauseGeneratingCondition = Exclude<
    ListCondition,
    'everyone' | 'isSupervisor' | 'nobody'
  >;

  const conditionSetClauses: QueryDslQueryContainer[][] = [];

  const conditionsThatAllowAll: ListCondition[] = user.isSupervisor
    ? ['everyone', 'isSupervisor']
    : ['everyone'];

  const conditionsThatBlockAll: ListCondition[] = user.isSupervisor
    ? ['nobody']
    : ['isSupervisor', 'nobody'];

  for (const caseListConditionSet of listConditionSets) {
    // Any condition set that has only 'all' conditions, i.e. 'everyone' (or 'isSupervisor' for supervisors)
    // means permissions are open regardless of what other conditions there are, so short circuit
    if (
      caseListConditionSet.length &&
      caseListConditionSet.every(condition => conditionsThatAllowAll.includes(condition))
    ) {
      // Returns an array with a single entry, which applies no filters
      return [[]];
    }

    // Any set that includes a 'nothing' condition, i.e. isSupervisor for non-supervisors, means all cases would be blocked by this condition set
    // But others might allow some cases, so we can't short circuit
    if (
      caseListConditionSet.length &&
      caseListConditionSet.some(condition => conditionsThatBlockAll.includes(condition))
    ) {
      continue;
    }

    // Apply filtering conditions
    const relevantConditions: WhereClauseGeneratingCondition[] =
      caseListConditionSet.filter(
        condition => !ALL_OR_NOTHING_CONDITIONS.includes(condition),
      ) as WhereClauseGeneratingCondition[];

    if (relevantConditions.length) {
      const conditionClauses: QueryDslQueryContainer[] = relevantConditions.map(
        condition => {
          if (isTimeBasedCondition(condition)) {
            return conditionWhereClauses.timeBasedCondition(condition);
          }
          const clause = conditionWhereClauses[condition as string]; // Not sure why TS is not happy with this, TimeBasedCondition is the only non-string condition AFAIK
          return typeof clause === 'function' ? clause(condition) : clause;
        },
      );

      if (conditionClauses.length) {
        conditionSetClauses.push(conditionClauses);
      }
    }
  }

  return conditionSetClauses.length ? conditionSetClauses : FILTER_ALL_CLAUSE;
};
