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

import { actionsMaps, Actions, isTargetKind, type TargetKind } from './actions';
import { parseConditionsSets } from './parser/parser';
import type { TKConditionsSets, RulesFile } from './rulesMap';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';

// const setupAllow = <T extends TargetKind>(kind: T, conditionsSets: ConditionsSets<T>) => {
const setupAllow = <T extends TargetKind>(
  kind: T,
  conditionsSets: TKConditionsSets<T>,
) => {
  // We could do type validation on target depending on targetKind if we ever want to make sure the "allow" is called on a proper target (same as cancan used to do)
  const parsedConditionsSets = parseConditionsSets(kind)(conditionsSets);

  return (performer: TwilioUser, target: any) => {
    const ctx = { curentTimestamp: new Date() };

    // If every condition is true for at least one set, the action is allowed
    return parsedConditionsSets.some(
      cs => cs.length && cs.every(c => c(performer, target, ctx)),
    );
  };
};

export const initializeCanForRules = (rules: RulesFile) => {
  const actionCheckers = {} as { [action in Actions]: ReturnType<typeof setupAllow> };

  const targetKinds = Object.keys(actionsMaps);
  targetKinds.forEach((targetKind: string) => {
    if (!isTargetKind(targetKind))
      throw new Error(`Invalid target kind ${targetKind} found in initializeCanForRules`);

    const actionsForTK = Object.values(actionsMaps[targetKind]);
    actionsForTK.forEach(action => {
      // console.log('action', action, 'targetKind', targetKind, 'rules[action]', rules[action])
      actionCheckers[action] = setupAllow(targetKind, rules[action]);
    });
  });

  return (performer: TwilioUser, action: Actions, target: any) =>
    actionCheckers[action](performer, target);
};

export type InitializedCan = ReturnType<typeof initializeCanForRules>;
