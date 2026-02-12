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
exports.initializeCanForRules = exports.applyTimeBasedConditions = exports.checkConditionsSets = void 0;
const conditionChecks_1 = require("./conditionChecks");
const actions_1 = require("./actions");
const rulesMap_1 = require("./rulesMap");
const date_fns_1 = require("date-fns");
const types_1 = require("@tech-matters/types");
/**
 * Given a conditionsState and a condition, returns true if the condition is true in the conditionsState
 */
const checkCondition = (conditionsState) => (condition) => {
    if (typeof condition === 'object') {
        return conditionsState[JSON.stringify(condition)];
    }
    return conditionsState[condition];
};
/**
 * Given a conditionsState and a set of conditions, returns true if all the conditions are true in the conditionsState
 */
const checkConditionsSet = (conditionsState) => (conditionsSet) => conditionsSet.length > 0 && conditionsSet.every(checkCondition(conditionsState));
/**
 * Given a conditionsState and a set of conditions sets, returns true if one of the conditions sets contains conditions that are all true in the conditionsState
 */
const checkConditionsSets = (conditionsState, conditionsSets) => conditionsSets.some(checkConditionsSet(conditionsState));
exports.checkConditionsSets = checkConditionsSets;
const applyTimeBasedConditions = (conditions) => (performer, target, ctx) => conditions
    .map(c => {
    const key = JSON.stringify(c);
    for (const [cond, param] of Object.entries(c)) {
        if (cond === 'createdHoursAgo') {
            const conditionMet = (0, date_fns_1.differenceInHours)(ctx.currentTimestamp, (0, date_fns_1.parseISO)(target.timeOfContact ??
                target.createdAt ??
                ctx.currentTimestamp.toISOString())) < param;
            console.debug('createdHoursAgo condition:', `${target.timeOfContact ?? target.createdAt} < ${param} hours before ${ctx.currentTimestamp.toISOString()}`, conditionMet);
            if (!conditionMet) {
                return {
                    [key]: false,
                };
            }
        }
        if (cond === 'createdDaysAgo') {
            const conditionMet = (0, date_fns_1.differenceInDays)(ctx.currentTimestamp, (0, date_fns_1.parseISO)(target.timeOfContact ?? target.createdAt)) < param;
            console.debug('createdDaysAgo condition:', `${target.timeOfContact ?? target.createdAt} < ${param} days before ${ctx.currentTimestamp.toISOString()}`, conditionMet);
            if (!conditionMet)
                return {
                    [key]: false,
                };
        }
    }
    return {
        [key]: true,
    };
})
    .reduce((accum, resolvedCondition) => ({
    ...accum,
    ...resolvedCondition,
}), {});
exports.applyTimeBasedConditions = applyTimeBasedConditions;
const applyProfileSectionSpecificConditions = (conditions) => (performer, target) => conditions
    .map(c => Object.entries(c)[0])
    .reduce((accum, [cond, param]) => {
    // use the stringified cond-param as key, e.g. '{ "sectionType": "summary" }'
    const key = JSON.stringify({ [cond]: param });
    if (cond === 'sectionType') {
        return {
            ...accum,
            [key]: target.sectionType === param,
        };
    }
    return accum;
}, {});
const applyContactFieldSpecificConditions = (conditions) => (performer, target) => conditions
    .map(c => Object.entries(c)[0])
    .reduce((accum, [cond, param]) => {
    // use the stringified cond-param as key, e.g. '{ "sectionType": "summary" }'
    const key = JSON.stringify({ [cond]: param });
    if (cond === 'field') {
        return {
            ...accum,
            [key]: target.field === param,
        };
    }
    return accum;
}, {});
const setupAllow = (kind, conditionsSets) => {
    // We could do type validation on target depending on targetKind if we ever want to make sure the "allow" is called on a proper target (same as cancan used to do)
    const timeBasedConditions = conditionsSets.flatMap(cs => cs.filter(rulesMap_1.isTimeBasedCondition));
    return (performer, target) => {
        const ctx = { currentTimestamp: new Date() };
        const appliedTimeBasedConditions = (0, exports.applyTimeBasedConditions)(timeBasedConditions)(performer, target, ctx);
        // Build the proper conditionsState depending on the targetKind
        switch (kind) {
            case 'case': {
                const targetCase = target;
                const conditionsState = {
                    isSupervisor: performer.isSupervisor,
                    isCreator: (0, conditionChecks_1.isCounselorWhoCreated)(performer, target),
                    isCaseOpen: (0, conditionChecks_1.isCaseOpen)(targetCase),
                    isCaseContactOwner: Boolean(targetCase.precalculatedPermissions?.userOwnsContact),
                    everyone: true,
                    ...appliedTimeBasedConditions,
                };
                return (0, exports.checkConditionsSets)(conditionsState, conditionsSets);
            }
            case 'contact': {
                const conditionsState = {
                    isSupervisor: performer.isSupervisor,
                    isOwner: (0, conditionChecks_1.isContactOwner)(performer, target),
                    everyone: true,
                    ...appliedTimeBasedConditions,
                };
                return (0, exports.checkConditionsSets)(conditionsState, conditionsSets);
            }
            case 'contactField': {
                const specificConditions = conditionsSets.flatMap(cs => cs
                    .map(c => ((0, rulesMap_1.isContactFieldSpecificCondition)(c) ? c : null))
                    .filter(c => c !== null));
                const appliedSpecificConditions = applyContactFieldSpecificConditions(specificConditions)(performer, target);
                const conditionsState = {
                    isSupervisor: performer.isSupervisor,
                    isOwner: (0, conditionChecks_1.isContactOwner)(performer, target),
                    everyone: true,
                    ...appliedTimeBasedConditions,
                    ...appliedSpecificConditions,
                };
                return (0, exports.checkConditionsSets)(conditionsState, conditionsSets);
            }
            case 'profile': {
                const conditionsState = {
                    isSupervisor: performer.isSupervisor,
                    everyone: true,
                    ...appliedTimeBasedConditions,
                };
                return (0, exports.checkConditionsSets)(conditionsState, conditionsSets);
            }
            case 'profileSection': {
                const specificConditions = conditionsSets.flatMap(cs => cs
                    .map(c => ((0, rulesMap_1.isProfileSectionSpecificCondition)(c) ? c : null))
                    .filter(c => c !== null));
                const appliedSpecificConditions = applyProfileSectionSpecificConditions(specificConditions)(performer, target);
                const conditionsState = {
                    isSupervisor: performer.isSupervisor,
                    everyone: true,
                    ...appliedTimeBasedConditions,
                    ...appliedSpecificConditions,
                };
                return (0, exports.checkConditionsSets)(conditionsState, conditionsSets);
            }
            case 'postSurvey': {
                const conditionsState = {
                    isSupervisor: performer.isSupervisor,
                    everyone: true,
                    ...appliedTimeBasedConditions,
                };
                return (0, exports.checkConditionsSets)(conditionsState, conditionsSets);
            }
            default: {
                (0, types_1.assertExhaustive)(kind);
            }
        }
    };
};
const initializeCanForRules = (rules) => {
    const actionCheckers = {};
    const targetKinds = Object.keys(actions_1.actionsMaps);
    targetKinds.forEach((targetKind) => {
        if (!(0, actions_1.isTargetKind)(targetKind)) {
            throw new Error(`Invalid target kind ${targetKind} found in initializeCanForRules`);
        }
        const actionsForTK = Object.values(actions_1.actionsMaps[targetKind]);
        actionsForTK.forEach(action => {
            actionCheckers[action] = setupAllow(targetKind, rules[action]);
        });
    });
    return (performer, action, target) => actionCheckers[action](performer, target);
};
exports.initializeCanForRules = initializeCanForRules;
