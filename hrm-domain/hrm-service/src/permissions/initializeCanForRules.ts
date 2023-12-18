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
import { actionsMaps, Actions, isTargetKind, TargetKind } from './actions';
import {
  isValidTKConditionsSets,
  type TKCondition,
  type TKConditionsSet,
  type TKConditionsSets,
  type RulesFile,
} from './rulesMap';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';

type ConditionsState<T extends TargetKind> = {
  [condition in TKCondition<T>]: boolean;
};

/**
 * Given a conditionsState and a condition, returns true if the condition is true in the conditionsState
 */
const checkCondition =
  <T extends TargetKind>(conditionsState: ConditionsState<T>) =>
  (condition: TKCondition<T>): boolean =>
    conditionsState[condition];

/**
 * Given a conditionsState and a set of conditions, returns true if all the conditions are true in the conditionsState
 */
const checkConditionsSet =
  <T extends TargetKind>(conditionsState: ConditionsState<T>) =>
  (conditionsSet: TKConditionsSet<T>): boolean =>
    conditionsSet.length > 0 && conditionsSet.every(checkCondition(conditionsState));

/**
 * Given a conditionsState and a set of conditions sets, returns true if one of the conditions sets contains conditions that are all true in the conditionsState
 */
const checkConditionsSets = <T extends TargetKind>(
  conditionsState: ConditionsState<T>,
  conditionsSets: TKConditionsSets<T>,
): boolean => conditionsSets.some(checkConditionsSet(conditionsState));

// const setupAllow = <T extends TargetKind>(kind: T, conditionsSets: ConditionsSets<T>) => {
const setupAllow = <T extends TargetKind>(
  kind: T,
  conditionsSets: TKConditionsSets<T>,
) => {
  // We could do type validation on target depending on targetKind if we ever want to make sure the "allow" is called on a proper target (same as cancan used to do)

  return (performer: TwilioUser, target: any) => {
    // Build the proper conditionsState depending on the targetKind
    if (kind === 'case') {
      if (!isValidTKConditionsSets<'case'>(kind)(conditionsSets)) {
        throw new Error(`setupAllow: Invalid conditionsSets provided for kind ${kind}`);
      }

      const conditionsState: ConditionsState<'case'> = {
        isSupervisor: performer.isSupervisor,
        isCreator: isCounselorWhoCreated(performer, target),
        isCaseOpen: isCaseOpen(target),
        everyone: true,
        createdDaysAgo: false,
        createdHoursAgo: false,
      };

      return checkConditionsSets(conditionsState, conditionsSets);
    } else if (kind === 'contact') {
      if (!isValidTKConditionsSets<'contact'>(kind)(conditionsSets)) {
        throw new Error(`setupAllow: Invalid conditionsSets provided for kind ${kind}`);
      }

      const conditionsState: ConditionsState<'contact'> = {
        isSupervisor: performer.isSupervisor,
        isOwner: isContactOwner(performer, target),
        everyone: true,
        createdDaysAgo: false,
        createdHoursAgo: false,
      };

      return checkConditionsSets(conditionsState, conditionsSets);
    } else if (kind === 'postSurvey') {
      if (!isValidTKConditionsSets<'postSurvey'>(kind)(conditionsSets)) {
        throw new Error(`setupAllow: Invalid conditionsSets provided for kind ${kind}`);
      }

      const conditionsState: ConditionsState<'postSurvey'> = {
        isSupervisor: performer.isSupervisor,
        everyone: true,
      };

      return checkConditionsSets(conditionsState, conditionsSets);
    }
  };
};

export const initializeCanForRules = (rules: RulesFile) => {
  const actionCheckers = {} as { [action in Actions]: ReturnType<typeof setupAllow> };

  const targetKinds = Object.keys(actionsMaps);
  targetKinds.forEach((targetKind: string) => {
    if (!isTargetKind(targetKind))
      throw new Error(`Invalid target kind ${targetKind} found in initializeCanForRules`);

    const actionsForTK = Object.values(actionsMaps[targetKind]);
    actionsForTK.forEach(
      action => (actionCheckers[action] = setupAllow(targetKind, rules[action])),
    );
  });

  return (performer: TwilioUser, action: Actions, target: any) =>
    actionCheckers[action](performer, target);
};

export type InitializedCan = ReturnType<typeof initializeCanForRules>;
