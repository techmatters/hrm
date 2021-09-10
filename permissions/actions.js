const diff = require('deep-diff');

const CLOSE_CASE = 'closeCase';
const REOPEN_CASE = 'reopenCase';
const CASE_STATUS_TRANSITION = 'caseStatusTransition';
const ADD_NOTE = 'addNote';
const EDIT_NOTE = 'editNote';
const ADD_REFERRAL = 'addReferral';
const EDIT_REFERRAL = 'editReferral';
const ADD_HOUSEHOLD = 'addHousehold';
const EDIT_HOUSEHOLD = 'editHousehold';
const ADD_PERPETRATOR = 'addPerpetrator';
const EDIT_PERPETRATOR = 'editPerpetrator';
const ADD_INCIDENT = 'addIncident';
const EDIT_INCIDENT = 'editIncident';
const EDIT_CASE_SUMMARY = 'editCaseSummary';
const VIEW_POST_SURVEY = 'viewPostSurvey';

// deep-diff lib kinds:
const NEW_PROPERTY = 'N';
const EDITED_PROPERTY = 'E';
const ARRAY_CHANGED = 'A';

const isPathEqual = (left, right) => left[0] === right[0] && left[1] === right[1];

const isAddOrEditKind = kind => [NEW_PROPERTY, EDITED_PROPERTY, ARRAY_CHANGED].includes(kind);

const isEditCaseSummary = change =>
  isAddOrEditKind(change.kind) && isPathEqual(change.path, ['info', 'summary']);

const isCloseCase = change =>
  change.kind === EDITED_PROPERTY &&
  isPathEqual(change.path, ['status']) &&
  change.rhs === 'closed';

const isReopenCase = change =>
  change.kind === EDITED_PROPERTY &&
  isPathEqual(change.path, ['status']) &&
  change.lhs === 'closed' &&
  change.rhs !== 'closed';

const isCaseStatusTransition = change =>
  change.kind === EDITED_PROPERTY &&
  isPathEqual(change.path, ['status']) &&
  change.lhs !== 'closed' &&
  change.rhs !== 'closed';

const isAddNote = change =>
  isAddOrEditKind(change.kind) && isPathEqual(change.path, ['info', 'notes']);

const isAddReferral = change =>
  isAddOrEditKind(change.kind) && isPathEqual(change.path, ['info', 'referrals']);

const isAddHousehold = change =>
  isAddOrEditKind(change.kind) && isPathEqual(change.path, ['info', 'households']);

const isAddPerpetrator = change =>
  isAddOrEditKind(change.kind) && isPathEqual(change.path, ['info', 'perpetrators']);

const isAddIncident = change =>
  isAddOrEditKind(change.kind) && isPathEqual(change.path, ['info', 'incidents']);

/**
 * This function compares the original object and the object with the updated values
 * to decide what actions it's trying to do, e.g.: [ADD_NOTE, ADD_REFERRAL]
 * @param {*} original the original object from DB
 * @param {*} updated the object with the updated values
 * @returns
 */
const getActions = (original, updated) => {
  const ignoredProperties = ['createdAt', 'updatedAt', 'connectedContacts'];
  const preFilter = (path, key) => ignoredProperties.includes(key);
  const changes = diff(original, updated, preFilter);

  const actions = [];
  if (changes) {
    changes.forEach(change => {
      if (isCloseCase(change)) actions.push(CLOSE_CASE);
      if (isReopenCase(change)) actions.push(REOPEN_CASE);
      if (isCaseStatusTransition(change)) actions.push(CASE_STATUS_TRANSITION);
      if (isAddNote(change)) actions.push(ADD_NOTE);
      if (isAddReferral(change)) actions.push(ADD_REFERRAL);
      if (isAddHousehold(change)) actions.push(ADD_HOUSEHOLD);
      if (isAddPerpetrator(change)) actions.push(ADD_PERPETRATOR);
      if (isAddIncident(change)) actions.push(ADD_INCIDENT);
      if (isEditCaseSummary(change)) actions.push(EDIT_CASE_SUMMARY);
    });
  }

  return actions;
};

module.exports = {
  getActions,
  CLOSE_CASE,
  REOPEN_CASE,
  CASE_STATUS_TRANSITION,
  ADD_NOTE,
  EDIT_NOTE,
  ADD_REFERRAL,
  EDIT_REFERRAL,
  ADD_HOUSEHOLD,
  EDIT_HOUSEHOLD,
  ADD_PERPETRATOR,
  EDIT_PERPETRATOR,
  ADD_INCIDENT,
  EDIT_INCIDENT,
  EDIT_CASE_SUMMARY,
  VIEW_POST_SURVEY,
};
