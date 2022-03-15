const diff = require('deep-diff');

// TODO: complete this actions with the ones that are in the frontend so a single file is shared
const actionsMaps = {
  case: {
    CLOSE_CASE: 'closeCase',
    REOPEN_CASE: 'reopenCase',
    CASE_STATUS_TRANSITION: 'caseStatusTransition',
    ADD_NOTE: 'addNote',
    EDIT_NOTE: 'editNote',
    ADD_REFERRAL: 'addReferral',
    EDIT_REFERRAL: 'editReferral',
    ADD_HOUSEHOLD: 'addHousehold',
    EDIT_HOUSEHOLD: 'editHousehold',
    ADD_PERPETRATOR: 'addPerpetrator',
    EDIT_PERPETRATOR: 'editPerpetrator',
    ADD_INCIDENT: 'addIncident',
    EDIT_INCIDENT: 'editIncident',
    ADD_DOCUMENT: 'addDocument',
    EDIT_DOCUMENT: 'editDocument',
    EDIT_CASE_SUMMARY: 'editCaseSummary',
    EDIT_CHILD_IS_AT_RISK: 'editChildIsAtRisk',
    EDIT_FOLLOW_UP_DATE: 'editFollowUpDate',
  },
  postSurvey: {
    VIEW_POST_SURVEY: 'viewPostSurvey',
  },
};

// deep-diff lib kinds:
const NEW_PROPERTY = 'N';
const EDITED_PROPERTY = 'E';
const ARRAY_CHANGED = 'A';
// eslint-disable-next-line no-unused-vars
const DELETED_PROPERTY = 'D';

/**
 * @param {string[]} target
 * @returns {function(string[]): bool}
 * Compares the target.length first components of a change path to decide if they refer to the same "case item type" under case.info (e.g. if it's editing the status, info (notes, perpetrators, etc))
 * Example paths are like:
 *   [ 'info', 'perpetrators' ] when adding a new perpetrator
 *   [ 'info', 'perpetrators', 0, 'perpetrator', 'phone1' ] when editin an existing perpetrator
 */
const isPathTarget = target => changePath =>
  target.every((value, index) => changePath[index] === value);

const isPathTargetsStatus = isPathTarget(['status']);
const isPathTargetsInfo = isPathTarget(['info']);

const isNewOrAddKind = kind => kind === NEW_PROPERTY || kind === ARRAY_CHANGED;
const isEditKind = kind => kind === EDITED_PROPERTY;
const isAddOrEditKind = kind => isNewOrAddKind(kind) || isEditKind(kind);

const isCloseCase = change =>
  isEditKind(change.kind) && isPathTargetsStatus(change.path) && change.rhs === 'closed';

const isReopenCase = change =>
  isEditKind(change.kind) &&
  isPathTargetsStatus(change.path) &&
  change.lhs === 'closed' &&
  change.rhs !== 'closed';

const isCaseStatusTransition = change =>
  isEditKind(change.kind) &&
  isPathTargetsStatus(change.path) &&
  change.lhs !== 'closed' &&
  change.rhs !== 'closed';

const isAddNote = change =>
  isNewOrAddKind(change.kind) && isPathTarget(['info', 'notes'])(change.path);

const isAddReferral = change =>
  isNewOrAddKind(change.kind) && isPathTarget(['info', 'referrals'])(change.path);

const isAddHousehold = change =>
  isNewOrAddKind(change.kind) && isPathTarget(['info', 'households'])(change.path);

const isAddPerpetrator = change =>
  isNewOrAddKind(change.kind) && isPathTarget(['info', 'perpetrators'])(change.path);

const isAddIncident = change =>
  isNewOrAddKind(change.kind) && isPathTarget(['info', 'incidents'])(change.path);

const isAddDocument = change =>
  isNewOrAddKind(change.kind) && isPathTarget(['info', 'documents'])(change.path);

const isEditNote = change =>
  isEditKind(change.kind) && isPathTarget(['info', 'notes'])(change.path);

const isEditReferral = change =>
  isEditKind(change.kind) && isPathTarget(['info', 'referrals'])(change.path);

const isEditHousehold = change =>
  isEditKind(change.kind) && isPathTarget(['info', 'households'])(change.path);

const isEditPerpetrator = change =>
  isEditKind(change.kind) && isPathTarget(['info', 'perpetrators'])(change.path);

const isEditIncident = change =>
  isEditKind(change.kind) && isPathTarget(['info', 'incidents'])(change.path);

const isEditDocument = change =>
  isEditKind(change.kind) && isPathTarget(['info', 'documents'])(change.path);

const isEditCaseSummary = change =>
  isAddOrEditKind(change.kind) && isPathTarget(['info', 'summary'])(change.path);

/**
 * This function compares the original object and the object with the updated values
 * to decide what actions it's trying to do, e.g.: [ADD_NOTE, EDIT_REFERRAL]
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
      if (isPathTargetsStatus(change.path)) {
        if (isCloseCase(change)) actions.push(actionsMaps.case.CLOSE_CASE);
        if (isReopenCase(change)) actions.push(actionsMaps.case.REOPEN_CASE);
        if (isCaseStatusTransition(change)) actions.push(actionsMaps.case.CASE_STATUS_TRANSITION);
      }

      if (isPathTargetsInfo(change.path)) {
        if (isAddNote(change)) actions.push(actionsMaps.case.ADD_NOTE);
        if (isAddReferral(change)) actions.push(actionsMaps.case.ADD_REFERRAL);
        if (isAddHousehold(change)) actions.push(actionsMaps.case.ADD_HOUSEHOLD);
        if (isAddPerpetrator(change)) actions.push(actionsMaps.case.ADD_PERPETRATOR);
        if (isAddIncident(change)) actions.push(actionsMaps.case.ADD_INCIDENT);
        if (isAddDocument(change)) actions.push(actionsMaps.case.ADD_DOCUMENT);
        if (isEditCaseSummary(change)) actions.push(actionsMaps.case.EDIT_CASE_SUMMARY);
        if (isEditNote(change)) actions.push(actionsMaps.case.EDIT_NOTE);
        if (isEditReferral(change)) actions.push(actionsMaps.case.EDIT_REFERRAL);
        if (isEditHousehold(change)) actions.push(actionsMaps.case.EDIT_HOUSEHOLD);
        if (isEditPerpetrator(change)) actions.push(actionsMaps.case.EDIT_PERPETRATOR);
        if (isEditIncident(change)) actions.push(actionsMaps.case.EDIT_INCIDENT);
        if (isEditDocument(change)) actions.push(actionsMaps.case.EDIT_DOCUMENT);
      }
    });
  }

  return actions;
};

module.exports = {
  getActions,
  actionsMaps,
};
