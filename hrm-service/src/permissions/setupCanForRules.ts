import { isCounselorWhoCreated, isSupervisor, isCaseOpen, isContactOwner } from './helpers';
import { actionsMaps, Actions, isTargetKind } from './actions';
// eslint-disable-next-line prettier/prettier
import type { Condition, ConditionsSet, ConditionsSets, RulesFile } from './rulesMap' ;
import { User } from './user';

/**
 * Given a conditionsState and a condition, returns true if the condition is true in the conditionsState
 */
 const checkCondition = (conditionsState: { [condition in Condition]: boolean }) => (condition: Condition): boolean => conditionsState[condition];

/**
 * Given a conditionsState and a set of conditions, returns true if all the conditions are true in the conditionsState
 */
 const checkConditionsSet = (conditionsState: { [condition in Condition]: boolean }) => (conditionsSet: ConditionsSet): boolean =>
 conditionsSet.length > 0 && conditionsSet.every(checkCondition(conditionsState));

/**
 * Given a conditionsState and a set of conditions sets, returns true if one of the conditions sets contains conditions that are all true in the conditionsState
 */
 const checkConditionsSets = (conditionsState: { [condition in Condition]: boolean }, conditionsSets: ConditionsSets): boolean =>
 conditionsSets.some(checkConditionsSet(conditionsState));

const setupAllow = (targetKind: string, conditionsSets: ConditionsSets) => {
  if (!isTargetKind(targetKind)) throw new Error(`Invalid target kind ${targetKind} provided to setupAllow`);

  // We could do type validation on target depending on targetKind if we ever want to make sure the "allow" is called on a proper target (same as cancan used to do)

  return (performer: User, target: any) => {
    // Build the proper conditionsState depending on the targetKind
    let conditionsState = null;
    if (targetKind === 'case') {
      conditionsState = {
        isSupervisor: isSupervisor(performer),
        isCreator: isCounselorWhoCreated(performer, target),
        isCaseOpen: isCaseOpen(target),
        everyone: true,
      };
    } else if (targetKind === 'contact') {
      conditionsState = {
        isSupervisor: isSupervisor(performer),
        isOwner: isContactOwner(performer, target),
        everyone: true,
      };
    } else if (targetKind === 'postSurvey') {
      conditionsState = {
        isSupervisor: isSupervisor(performer),
        everyone: true,
      };
    }

    return checkConditionsSets(conditionsState, conditionsSets);
  };
};

export const setupCanForRules = (rules: RulesFile) => {
  const actionCheckers = {} as { [action in Actions]: ReturnType<typeof setupAllow> };

  const targetKinds = Object.keys(actionsMaps);
  targetKinds.forEach((targetKind: string) => {
    if (!isTargetKind(targetKind)) throw new Error(`Invalid target kind ${targetKind} found in setupCanForRules`);

    const actionsForTK = Object.values(actionsMaps[targetKind]);
    actionsForTK.forEach((action) => actionCheckers[action] = setupAllow(targetKind, rules[action]));
  });


  return (performer: User, action: Actions, target: any) =>
    actionCheckers[action](performer, target);
};
