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
const ADD_DOCUMENT = 'addDocument';
const EDIT_DOCUMENT = 'editDocument';
const EDIT_CASE_SUMMARY = 'editCaseSummary';
const VIEW_POST_SURVEY = 'viewPostSurvey';

// deep-diff lib kinds:
const NEW_PROPERTY = 'N';
const EDITED_PROPERTY = 'E';
const ARRAY_CHANGED = 'A';
// eslint-disable-next-line no-unused-vars
const DELETED_PROPERTY = 'D';

/**
 * Compares the two first components of a path to decide if they refer to the same "case item type" under case.info (e.g. if it's editing notes, perpetrators, etc)
 * Example paths are like:
 *   [ 'info', 'perpetrators' ] when adding a new perpetrator
 *   [ 'info', 'perpetrators', 0, 'perpetrator', 'phone1' ] when editin an existing perpetrator
 */
const isPathEqual = (left, right) => left[0] === right[0] && left[1] === right[1];

const isNewOrAddKind = kind => kind === NEW_PROPERTY || kind === ARRAY_CHANGED;
const isEditKind = kind => kind === EDITED_PROPERTY;
const isAddOrEditKind = kind => isNewOrAddKind(kind) || isEditKind(kind);

const isCloseCase = change =>
  isEditKind(change.kind) && isPathEqual(change.path, ['status']) && change.rhs === 'closed';

const isReopenCase = change =>
  isEditKind(change.kind) &&
  isPathEqual(change.path, ['status']) &&
  change.lhs === 'closed' &&
  change.rhs !== 'closed';

const isCaseStatusTransition = change =>
  isEditKind(change.kind) &&
  isPathEqual(change.path, ['status']) &&
  change.lhs !== 'closed' &&
  change.rhs !== 'closed';

const isAddNote = change =>
  isNewOrAddKind(change.kind) && isPathEqual(change.path, ['info', 'notes']);

const isAddReferral = change =>
  isNewOrAddKind(change.kind) && isPathEqual(change.path, ['info', 'referrals']);

const isAddHousehold = change =>
  isNewOrAddKind(change.kind) && isPathEqual(change.path, ['info', 'households']);

const isAddPerpetrator = change =>
  isNewOrAddKind(change.kind) && isPathEqual(change.path, ['info', 'perpetrators']);

const isAddIncident = change =>
  isNewOrAddKind(change.kind) && isPathEqual(change.path, ['info', 'incidents']);

const isAddDocument = change =>
  isNewOrAddKind(change.kind) && isPathEqual(change.path, ['info', 'documents']);

const isEditNote = change => isEditKind(change.kind) && isPathEqual(change.path, ['info', 'notes']);

const isEditReferral = change =>
  isEditKind(change.kind) && isPathEqual(change.path, ['info', 'referrals']);

const isEditHousehold = change =>
  isEditKind(change.kind) && isPathEqual(change.path, ['info', 'households']);

const isEditPerpetrator = change =>
  isEditKind(change.kind) && isPathEqual(change.path, ['info', 'perpetrators']);

const isEditIncident = change =>
  isEditKind(change.kind) && isPathEqual(change.path, ['info', 'incidents']);

const isEditDocument = change =>
  isEditKind(change.kind) && isPathEqual(change.path, ['info', 'documents']);

const isEditCaseSummary = change =>
  isAddOrEditKind(change.kind) && isPathEqual(change.path, ['info', 'summary']);

/**
 * This function compares the original object and the object with the updated values
 * to decide what actions it's trying to do, e.g.: [ADD_NOTE, ADD_REFERRAL]
 * @param {*} original the original object from DB
 * @param {*} updated the object with the updated values
 * @returns
 */
const getActions = (original, updated) => {
  // Filter out the topmost properties not included in the payload to avoid false DELETED_PROPERTY (as we send Partial<Case> from the frontend)
  const partialOriginal = Object.keys(updated).reduce(
    (accum, currentKey) =>
      Object.prototype.hasOwnProperty.call(original, currentKey)
        ? { ...accum, [currentKey]: original[currentKey] }
        : accum,
    {},
  );
  const ignoredProperties = ['createdAt', 'updatedAt', 'connectedContacts'];
  const preFilter = (path, key) => ignoredProperties.includes(key);
  const changes = diff(partialOriginal, updated, preFilter);

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
      if (isAddDocument(change)) actions.push(ADD_DOCUMENT);
      if (isEditCaseSummary(change)) actions.push(EDIT_CASE_SUMMARY);
      if (isEditNote(change)) actions.push(EDIT_NOTE);
      if (isEditReferral(change)) actions.push(EDIT_REFERRAL);
      if (isEditHousehold(change)) actions.push(EDIT_HOUSEHOLD);
      if (isEditPerpetrator(change)) actions.push(EDIT_PERPETRATOR);
      if (isEditIncident(change)) actions.push(EDIT_INCIDENT);
      if (isEditDocument(change)) actions.push(EDIT_DOCUMENT);
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
  ADD_DOCUMENT,
  EDIT_DOCUMENT,
  EDIT_CASE_SUMMARY,
  VIEW_POST_SURVEY,
};
