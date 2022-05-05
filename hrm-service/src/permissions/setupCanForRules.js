const CanCan = require('cancan');
const { isCounselorWhoCreated, isSupervisor, isCaseOpen } = require('./helpers');
const { actionsMaps } = require('./actions');
const User = require('./user');
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

const bindSetupAllow = allow => (
  performerModel,
  action,
  targetModel,
  targetKind,
  conditionsSets,
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

const setupCanForRules = rules => {
  const rulesAreValid = Object.values(actionsMaps).every(map =>
    Object.values(map).every(action => rules[action]),
  );

  if (!rulesAreValid) {
    return 'Rules file incomplete.';
  }

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

module.exports = {
  setupCanForRules,
};
