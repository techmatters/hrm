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

import { isCounselorWhoCreated, isCaseOpen, isContactOwner } from './helpers';
import { actionsMaps, Actions, isTargetKind } from './actions';
import type { Condition, ConditionsSet, ConditionsSets, RulesFile } from './rulesMap';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';

/**
 * Given a conditionsState and a condition, returns true if the condition is true in the conditionsState
 */
const checkCondition =
  (conditionsState: { [condition in Condition]: boolean }) =>
  (condition: Condition): boolean =>
    conditionsState[condition];

/**
 * Given a conditionsState and a set of conditions, returns true if all the conditions are true in the conditionsState
 */
const checkConditionsSet =
  (conditionsState: { [condition in Condition]: boolean }) =>
  (conditionsSet: ConditionsSet): boolean =>
    conditionsSet.length > 0 && conditionsSet.every(checkCondition(conditionsState));

/**
 * Given a conditionsState and a set of conditions sets, returns true if one of the conditions sets contains conditions that are all true in the conditionsState
 */
const checkConditionsSets = (
  conditionsState: { [condition in Condition]: boolean },
  conditionsSets: ConditionsSets,
): boolean => conditionsSets.some(checkConditionsSet(conditionsState));

const setupAllow = (targetKind: string, conditionsSets: ConditionsSets) => {
  if (!isTargetKind(targetKind))
    throw new Error(`Invalid target kind ${targetKind} provided to setupAllow`);

  // We could do type validation on target depending on targetKind if we ever want to make sure the "allow" is called on a proper target (same as cancan used to do)

  return (performer: TwilioUser, target: any) => {
    // Build the proper conditionsState depending on the targetKind
    let conditionsState = null;
    if (targetKind === 'case') {
      conditionsState = {
        isSupervisor: performer.isSupervisor,
        isCreator: isCounselorWhoCreated(performer, target),
        isCaseOpen: isCaseOpen(target),
        everyone: true,
      };
    } else if (targetKind === 'contact') {
      conditionsState = {
        isSupervisor: performer.isSupervisor,
        isOwner: isContactOwner(performer, target),
        everyone: true,
      };
    } else if (targetKind === 'postSurvey') {
      conditionsState = {
        isSupervisor: performer.isSupervisor,
        everyone: true,
      };
    }

    return checkConditionsSets(conditionsState, conditionsSets);
  };
};

export const initializeCanForRules = (rules: RulesFile) => {
  const actionCheckers = {} as { [action in Actions]: ReturnType<typeof setupAllow> };

  const targetKinds = Object.keys(actionsMaps);
  targetKinds.forEach((targetKind: string) => {
    if (!isTargetKind(targetKind))
      throw new Error(`Invalid target kind ${targetKind} found in setupCanForRules`);

    const actionsForTK = Object.values(actionsMaps[targetKind]);
    actionsForTK.forEach(
      action => (actionCheckers[action] = setupAllow(targetKind, rules[action])),
    );
  });

  return (performer: TwilioUser, action: Actions, target: any) =>
    actionCheckers[action](performer, target);
};

export type InitializedCan = ReturnType<typeof initializeCanForRules>;
