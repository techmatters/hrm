import CanCan from 'cancan';
import { isCounselorWhoCreated, isSupervisor, isCaseOpen } from './helpers';
import { actionsMaps } from './actions';
import { User } from './user';
import models from '../models';
// eslint-disable-next-line prettier/prettier
import type { Condition, ConditionsSet, ConditionsSets, RulesFile } from './rulesMap' ;

const { Case, PostSurvey } = models;

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

 const bindSetupAllow = (allow: CanCan['allow']) => (
  performerModel: any,
  action: string,
  targetModel: any,
  targetKind: string,
  conditionsSets: ConditionsSets,
) => {
  allow(performerModel, action, targetModel, (performer, target) => {
    // Build the proper conditionsState depending on the targetKind
    let conditionsState = null;
    if (targetKind === 'case') {
      conditionsState = {
        isSupervisor: isSupervisor(performer),
        isCreator: isCounselorWhoCreated(performer, target),
        isCaseOpen: isCaseOpen(target),
        everyone: true,
      };
    } else if (targetKind === 'postSurvey') {
      conditionsState = {
        isSupervisor: isSupervisor(performer),
        everyone: true,
      };
    }

    return checkConditionsSets(conditionsState, conditionsSets);
  });
};

export const setupCanForRules = (rules: RulesFile) => {
  const cancan = new CanCan();
  const { can, allow } = cancan;
  const setupAllow = bindSetupAllow(allow);

  // Configure Case permissions
  Object.values(actionsMaps.case).forEach(action =>
    setupAllow(User, action, Case, 'case', rules[action]),
  );

  // Configure PostSurvey permissions
  Object.values(actionsMaps.postSurvey).forEach(action =>
    setupAllow(User, action, PostSurvey, 'postSurvey', rules[action]),
  );

  return can;
};
