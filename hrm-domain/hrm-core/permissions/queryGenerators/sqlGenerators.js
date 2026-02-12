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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPermissionWhereClause = void 0;
const rulesMap_1 = require("../rulesMap");
const FILTER_ALL_CASES_CLAUSE = ['1=0'];
const listPermissionWhereClause = (listConditionSets, userIsSupervisor, conditionWhereClauses) => {
    const ALL_OR_NOTHING_CONDITIONS = ['everyone', 'isSupervisor'];
    const conditionSetClauses = [];
    const conditionsThatAllowAll = userIsSupervisor
        ? ALL_OR_NOTHING_CONDITIONS
        : ['everyone'];
    const conditionsThatBlockAll = userIsSupervisor
        ? []
        : ['isSupervisor'];
    for (const caseListConditionSet of listConditionSets) {
        // Any condition set that has only 'all' conditions, i.e. 'everyone' (or 'isSupervisor' for supervisors)
        // means permissions are open regardless of what other conditions there are, so short circuit
        if (caseListConditionSet.length &&
            caseListConditionSet.every(condition => conditionsThatAllowAll.includes(condition))) {
            return [];
        }
        // Any set that includes a 'nothing' condition, i.e. isSupervisor for non-supervisors, means all cases would be blocked by this condition set
        // But others might allow some cases, so we can't short circuit
        if (caseListConditionSet.length &&
            caseListConditionSet.some(condition => conditionsThatBlockAll.includes(condition))) {
            continue;
        }
        // Apply filtering conditions
        const relevantConditions = caseListConditionSet.filter(condition => !ALL_OR_NOTHING_CONDITIONS.includes(condition));
        if (relevantConditions.length) {
            const conditionClauses = relevantConditions
                .map(condition => {
                if ((0, rulesMap_1.isTimeBasedCondition)(condition)) {
                    return conditionWhereClauses.timeBasedCondition?.(condition) ?? undefined;
                }
                const clause = conditionWhereClauses[condition]; // Not sure why TS is not happy with this, TimeBasedCondition is the only non-string condition AFAIK
                return typeof clause === 'function' ? clause(condition) : clause;
            })
                .filter(Boolean);
            if (conditionClauses.length) {
                conditionSetClauses.push(`(${conditionClauses.join(' AND ')})`);
            }
        }
    }
    return conditionSetClauses.length
        ? [`(${conditionSetClauses.join(' OR ')})`]
        : FILTER_ALL_CASES_CLAUSE;
};
exports.listPermissionWhereClause = listPermissionWhereClause;
