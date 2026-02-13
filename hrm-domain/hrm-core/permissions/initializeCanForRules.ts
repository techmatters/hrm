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

import { isCounselorWhoCreated, isCaseOpen, isContactOwner } from './conditionChecks';
import { actionsMaps, Actions, isTargetKind, TargetKind } from './actions';
import {
  type TKCondition,
  type TKConditionsSet,
  type TKConditionsSets,
  type RulesFile,
  isTimeBasedCondition,
  TimeBasedCondition,
  ProfileSectionSpecificCondition,
  isProfileSectionSpecificCondition,
  ContactFieldSpecificCondition,
  isContactFieldSpecificCondition,
} from './rulesMap';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { differenceInDays, differenceInHours, parseISO } from 'date-fns';
import { assertExhaustive } from '@tech-matters/types';
import { CaseService } from '../case/caseService';

export type ConditionsState = {
  [k: string]: boolean;
};

/**
 * Given a conditionsState and a condition, returns true if the condition is true in the conditionsState
 */
const checkCondition =
  <T extends TargetKind>(conditionsState: ConditionsState) =>
  (condition: TKCondition<T>): boolean => {
    if (typeof condition === 'object') {
      return conditionsState[JSON.stringify(condition)];
    }

    return conditionsState[condition as string];
  };

/**
 * Given a conditionsState and a set of conditions, returns true if all the conditions are true in the conditionsState
 */
const checkConditionsSet =
  <T extends TargetKind>(conditionsState: ConditionsState) =>
  (conditionsSet: TKConditionsSet<T>): boolean =>
    conditionsSet.length > 0 && conditionsSet.every(checkCondition(conditionsState));

/**
 * Given a conditionsState and a set of conditions sets, returns true if one of the conditions sets contains conditions that are all true in the conditionsState
 */
export const checkConditionsSets = <T extends TargetKind>(
  conditionsState: ConditionsState,
  conditionsSets: TKConditionsSets<T>,
): boolean => conditionsSets.some(checkConditionsSet(conditionsState));

export const applyTimeBasedConditions =
  (conditions: TimeBasedCondition[]) =>
  (performer: TwilioUser, target: any, ctx: { currentTimestamp: Date }) =>
    conditions
      .map(c => {
        const key = JSON.stringify(c);
        for (const [cond, param] of Object.entries(c)) {
          if (cond === 'createdHoursAgo') {
            const conditionMet =
              differenceInHours(
                ctx.currentTimestamp,
                parseISO(
                  target.timeOfContact ??
                    target.createdAt ??
                    ctx.currentTimestamp.toISOString(),
                ),
              ) < param;
            console.debug(
              'createdHoursAgo condition:',
              `${
                target.timeOfContact ?? target.createdAt
              } < ${param} hours before ${ctx.currentTimestamp.toISOString()}`,
              conditionMet,
            );
            if (!conditionMet) {
              return {
                [key]: false,
              };
            }
          }
          if (cond === 'createdDaysAgo') {
            const conditionMet =
              differenceInDays(
                ctx.currentTimestamp,
                parseISO(
                  target.timeOfContact ??
                    target.createdAt ??
                    ctx.currentTimestamp.toISOString(),
                ),
              ) < param;
            console.debug(
              'createdDaysAgo condition:',
              `${
                target.timeOfContact ?? target.createdAt
              } < ${param} days before ${ctx.currentTimestamp.toISOString()}`,
              conditionMet,
            );
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
      .reduce<Record<string, boolean>>(
        (accum, resolvedCondition) => ({
          ...accum,
          ...resolvedCondition,
        }),
        {},
      );

const applyProfileSectionSpecificConditions =
  (conditions: ProfileSectionSpecificCondition[]) =>
  (performer: TwilioUser, target: any) =>
    conditions
      .map(c => Object.entries(c)[0])
      .reduce<Record<string, boolean>>((accum, [cond, param]) => {
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

const applyContactFieldSpecificConditions =
  (conditions: ContactFieldSpecificCondition[]) => (performer: TwilioUser, target: any) =>
    conditions
      .map(c => Object.entries(c)[0])
      .reduce<Record<string, boolean>>((accum, [cond, param]) => {
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

const setupAllow = <T extends TargetKind>(
  kind: T,
  conditionsSets: TKConditionsSets<T>,
) => {
  // We could do type validation on target depending on targetKind if we ever want to make sure the "allow" is called on a proper target (same as cancan used to do)
  const timeBasedConditions = conditionsSets.flatMap(cs =>
    cs.filter(isTimeBasedCondition),
  );

  return (performer: TwilioUser, target: any) => {
    const ctx = { currentTimestamp: new Date() };

    const appliedTimeBasedConditions = applyTimeBasedConditions(timeBasedConditions)(
      performer,
      target,
      ctx,
    );

    // Build the proper conditionsState depending on the targetKind
    switch (kind) {
      case 'case': {
        const targetCase = target as CaseService;
        const conditionsState: ConditionsState = {
          isSupervisor: performer.isSupervisor,
          isCreator: isCounselorWhoCreated(performer, target),
          isCaseOpen: isCaseOpen(targetCase),
          isCaseContactOwner: Boolean(
            targetCase.precalculatedPermissions?.userOwnsContact,
          ),
          everyone: true,
          ...appliedTimeBasedConditions,
        };

        return checkConditionsSets(conditionsState, conditionsSets);
      }
      case 'contact': {
        const conditionsState: ConditionsState = {
          isSupervisor: performer.isSupervisor,
          isOwner: isContactOwner(performer, target),
          everyone: true,
          ...appliedTimeBasedConditions,
        };

        return checkConditionsSets(conditionsState, conditionsSets);
      }
      case 'contactField': {
        const specificConditions = conditionsSets.flatMap(cs =>
          cs
            .map(c => (isContactFieldSpecificCondition(c) ? c : null))
            .filter(c => c !== null),
        );
        const appliedSpecificConditions = applyContactFieldSpecificConditions(
          specificConditions,
        )(performer, target);

        const conditionsState: ConditionsState = {
          isSupervisor: performer.isSupervisor,
          isOwner: isContactOwner(performer, target),
          everyone: true,
          ...appliedTimeBasedConditions,
          ...appliedSpecificConditions,
        };

        return checkConditionsSets(conditionsState, conditionsSets);
      }
      case 'profile': {
        const conditionsState: ConditionsState = {
          isSupervisor: performer.isSupervisor,
          everyone: true,
          ...appliedTimeBasedConditions,
        };

        return checkConditionsSets(conditionsState, conditionsSets);
      }
      case 'profileSection': {
        const specificConditions = conditionsSets.flatMap(cs =>
          cs
            .map(c => (isProfileSectionSpecificCondition(c) ? c : null))
            .filter(c => c !== null),
        );

        const appliedSpecificConditions = applyProfileSectionSpecificConditions(
          specificConditions,
        )(performer, target);

        const conditionsState: ConditionsState = {
          isSupervisor: performer.isSupervisor,
          everyone: true,
          ...appliedTimeBasedConditions,
          ...appliedSpecificConditions,
        };

        return checkConditionsSets(conditionsState, conditionsSets);
      }
      case 'postSurvey': {
        const conditionsState: ConditionsState = {
          isSupervisor: performer.isSupervisor,
          everyone: true,
          ...appliedTimeBasedConditions,
        };

        return checkConditionsSets(conditionsState, conditionsSets);
      }
      default: {
        assertExhaustive(kind);
      }
    }
  };
};

export const initializeCanForRules = (rules: RulesFile) => {
  const actionCheckers = {} as { [action in Actions]: ReturnType<typeof setupAllow> };

  const targetKinds = Object.keys(actionsMaps);
  targetKinds.forEach((targetKind: string) => {
    if (!isTargetKind(targetKind)) {
      throw new Error(`Invalid target kind ${targetKind} found in initializeCanForRules`);
    }

    const actionsForTK = Object.values(actionsMaps[targetKind]);
    actionsForTK.forEach(action => {
      actionCheckers[action] = setupAllow(targetKind, rules[action]);
    });
  });

  return (performer: TwilioUser, action: Actions, target: any) =>
    actionCheckers[action](performer, target);
};

export type InitializedCan = ReturnType<typeof initializeCanForRules>;
