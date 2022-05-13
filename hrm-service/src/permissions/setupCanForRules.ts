import { isCounselorWhoCreated, isSupervisor, isCaseOpen } from './helpers';
import { actionsMaps } from './actions';
import { User } from './user';
const models = require('../models');

const { Case, PostSurvey } = models;

/**
 * Given a conditionsState and a condition, returns true if the condition is true in the conditionsState
 * @param {{ [condition in 'isSupervisor' | 'isCreator' | 'isCaseOpen' | 'everyone']: boolean }} conditionsState
 * @returns {(condition: 'isSupervisor' | 'isCreator' | 'isCaseOpen' | 'everyone') => boolean}
 */
const checkCondition = conditionsState => condition => conditionsState[condition];

/**
 * Given a conditionsState and a set of conditions, returns true if all the conditions are true in the conditionsState
 * @param {{ [condition in 'isSupervisor' | 'isCreator' | 'isCaseOpen' | 'everyone']: boolean }} conditionsState
 * @returns {(conditionsSet: 'isSupervisor' | 'isCreator' | 'isCaseOpen' | 'everyone'[]) => boolean}
 */
const checkConditionsSet = conditionsState => conditionsSet =>
  conditionsSet.length > 0 && conditionsSet.every(checkCondition(conditionsState));

/**
 * Given a conditionsState and a set of conditions sets, returns true if one of the conditions sets contains conditions that are all true in the conditionsState
 * @param {{ [condition in 'isSupervisor' | 'isCreator' | 'isCaseOpen' | 'everyone']: boolean }} conditionsState
 * @param {'isSupervisor' | 'isCreator' | 'isCaseOpen' | 'everyone'[][]} conditionsSets
 */
const checkConditionsSets = (conditionsState, conditionsSets) =>
  conditionsSets.some(checkConditionsSet(conditionsState));

const setupAllow = (action, targetKind, conditionsSets) => {
  return (performer, target) => {
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
  };
};

export const setupCanForRules = rules => {
  const rulesAreValid = Object.values(actionsMaps).every(map =>
    Object.values(map).every(action => rules[action]),
  );

  if (!rulesAreValid) {
    return 'Rules file incomplete.';
  }

  const actionCheckers: Record<string, (performer: any, target: any) => boolean> = {};

  // Configure Case permissions
  Object.values(actionsMaps.case).forEach(
    action => (actionCheckers[action] = setupAllow(action, 'case', rules[action])),
  );

  // Configure PostSurvey permissions
  Object.values(actionsMaps.postSurvey).forEach(
    action => (actionCheckers[action] = setupAllow(action, 'postSurvey', rules[action])),
  );

  return (performer: any, action: string, target: any): boolean =>
    actionCheckers[action](performer, target);
};
