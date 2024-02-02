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

import { diff, Diff, DiffNew, DiffEdit, DiffArray } from 'deep-diff';
import { Request } from 'express';

export const actionsMaps = {
  case: {
    VIEW_CASE: 'viewCase',
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
    EDIT_CASE_OVERVIEW: 'editCaseOverview',
    EDIT_CHILD_IS_AT_RISK: 'editChildIsAtRisk',
    EDIT_FOLLOW_UP_DATE: 'editFollowUpDate',
    UPDATE_CASE_CONTACTS: 'updateCaseContacts',
  },
  contact: {
    VIEW_CONTACT: 'viewContact',
    EDIT_CONTACT: 'editContact',
    VIEW_EXTERNAL_TRANSCRIPT: 'viewExternalTranscript',
    VIEW_RECORDING: 'viewRecording',
    ADD_CONTACT_TO_CASE: 'addContactToCase',
    REMOVE_CONTACT_FROM_CASE: 'removeContactFromCase',
  },
  postSurvey: {
    VIEW_POST_SURVEY: 'viewPostSurvey',
  },
} as const;

export type TargetKind = keyof typeof actionsMaps;
export const isTargetKind = (s: string): s is TargetKind => Boolean(actionsMaps[s]);

/**
 * Utility type that given an object with any nesting depth, will return the union of all the leaves that are of type "string"
 */
type NestedStringValues<T> = T extends object
  ? { [K in keyof T]: T[K] extends string ? T[K] : NestedStringValues<T[K]> }[keyof T]
  : never;

export type Actions = NestedStringValues<typeof actionsMaps>;

export const isValidSetOfActionsForTarget = <T extends TargetKind>(
  targetKind: T,
  actions: unknown,
): actions is Actions[] => {
  const validActionsOnTarget = Object.values(actionsMaps[targetKind]);
  return (
    Array.isArray(actions) &&
    actionsMaps[targetKind] &&
    actions.every(action => validActionsOnTarget.includes(action))
  );
};

// deep-diff lib kinds:
const NEW_PROPERTY = 'N';
const EDITED_PROPERTY = 'E';
const ARRAY_CHANGED = 'A';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DELETED_PROPERTY = 'D';

/**
 * Compares the target.length first components of a change path to decide if they refer to the same "case item type" under case.info (e.g. if it's editing the status, info (notes, perpetrators, etc))
 * Example paths are like:
 *   [ 'info', 'perpetrators' ] when adding a new perpetrator
 *   [ 'info', 'perpetrators', 0, 'perpetrator', 'phone1' ] when editin an existing perpetrator
 */
const isPathTarget =
  (target: string[]) =>
  (changePath: string[]): boolean =>
    target.every((value, index) => changePath[index] === value) &&
    target.length === changePath.length;

const isDescendantPathTarget =
  (target: string[]) =>
  (changePath: string[]): boolean =>
    target.every((value, index) => changePath[index] === value) &&
    target.length < changePath.length;

const isPathTargetsStatus = isPathTarget(['status']);
const isPathTargetsInfo = isDescendantPathTarget(['info']);

const isNewKind = <T>(change: Diff<T>): change is DiffNew<T> =>
  change.kind === NEW_PROPERTY;

const isArrayKind = <T>(change: Diff<T>): change is DiffArray<T> =>
  change.kind === ARRAY_CHANGED;

const isNewOrAddKind = <T>(change: Diff<T>) => isNewKind(change) || isArrayKind(change);

const isEditKind = <T>(change: Diff<T>): change is DiffEdit<T> =>
  change.kind === EDITED_PROPERTY;

const isAddOrEditKind = <T>(change: Diff<T>) =>
  isNewOrAddKind(change) || isEditKind(change);

const isCloseCase = (change: Diff<any>) =>
  isEditKind(change) && isPathTargetsStatus(change.path) && change.rhs === 'closed';

const isReopenCase = (change: Diff<any>) =>
  isEditKind(change) &&
  isPathTargetsStatus(change.path) &&
  change.lhs === 'closed' &&
  change.rhs !== 'closed';

const isCaseStatusTransition = (change: Diff<any>) =>
  isEditKind(change) &&
  isPathTargetsStatus(change.path) &&
  change.lhs !== 'closed' &&
  change.rhs !== 'closed';

const isAddNote = (change: Diff<any>) =>
  isNewOrAddKind(change) && isPathTarget(['info', 'counsellorNotes'])(change.path);

const isAddReferral = (change: Diff<any>) =>
  isNewOrAddKind(change) && isPathTarget(['info', 'referrals'])(change.path);

const isAddHousehold = (change: Diff<any>) =>
  isNewOrAddKind(change) && isPathTarget(['info', 'households'])(change.path);

const isAddPerpetrator = (change: Diff<any>) =>
  isNewOrAddKind(change) && isPathTarget(['info', 'perpetrators'])(change.path);

const isAddIncident = (change: Diff<any>) =>
  isNewOrAddKind(change) && isPathTarget(['info', 'incidents'])(change.path);

const isAddDocument = (change: Diff<any>) =>
  isNewOrAddKind(change) && isPathTarget(['info', 'documents'])(change.path);

const isSectionEdit = (sectionName: string) => (change: Diff<any>) =>
  (isEditKind(change) && isPathTarget(['info', sectionName])(change.path)) ||
  isDescendantPathTarget(['info', sectionName])(change.path);

const isEditNote = isSectionEdit('counsellorNotes');
const isEditReferral = isSectionEdit('referrals');
const isEditHousehold = isSectionEdit('households');
const isEditPerpetrator = isSectionEdit('perpetrators');
const isEditIncident = isSectionEdit('incidents');
const isEditDocument = isSectionEdit('documents');

const isEditCaseOverview = (change: Diff<any>) =>
  isAddOrEditKind(change) &&
  (isPathTarget(['info', 'summary'])(change.path) ||
    isPathTarget(['info', 'childIsAtRisk'])(change.path) ||
    isPathTarget(['info', 'followUpDate'])(change.path));

function sectionCompare(a: { createdAt: string }, b: { createdAt: string }) {
  if (a.createdAt < b.createdAt) {
    return -1;
  }
  if (a.createdAt > b.createdAt) {
    return 1;
  }
  return 0;
}

function sortedSections(original: any): any {
  if (original.info) {
    const sortedInfo = {
      ...original.info,
    };

    if (original.info.counsellorNotes) {
      sortedInfo.counsellorNotes = [
        ...original.info.counsellorNotes.sort(sectionCompare),
      ];
    }

    if (original.info.referrals) {
      sortedInfo.referrals = [...original.info.referrals.sort(sectionCompare)];
    }

    if (original.info.households) {
      sortedInfo.households = [...original.info.households.sort(sectionCompare)];
    }

    if (original.info.perpetrators) {
      sortedInfo.perpetrators = [...original.info.perpetrators.sort(sectionCompare)];
    }

    if (original.info.incidents) {
      sortedInfo.incidents = [...original.info.incidents.sort(sectionCompare)];
    }

    if (original.info.documents) {
      sortedInfo.documents = [...original.info.documents.sort(sectionCompare)];
    }

    return { ...original, info: sortedInfo };
  }
  return { ...original };
}

/**
 * This function compares the original object and the object with the updated values
 * to decide what actions it's trying to do, e.g.: [ADD_NOTE, EDIT_REFERRAL]
 * @param {*} original the original object from DB
 * @param {*} updated the object with the updated values
 * @returns
 */
export const getActions = (original: any, { body: updated }: Request) => {
  // Filter out the topmost properties not included in the payload to avoid false DELETED_PROPERTY (as we send Partial<Case> from the frontend)
  let partialOriginal: any = Object.keys(updated).reduce(
    (accum, currentKey) =>
      Object.prototype.hasOwnProperty.call(original, currentKey)
        ? { ...accum, [currentKey]: original[currentKey] }
        : accum,
    {},
  );
  const ignoredProperties = ['createdAt', 'updatedAt', 'connectedContacts'];
  const preFilter = (path: any, key: string) => ignoredProperties.includes(key);
  const changes = diff(
    sortedSections(partialOriginal),
    sortedSections(updated),
    preFilter,
  );

  const actions = [];
  if (changes) {
    changes.forEach(change => {
      // TODO: Deprecate this code when we stop allowing case status to be updated in the general update case endpoint
      // Thw last version of Flex that does this should be v2.12.x - but check first!
      if (isPathTargetsStatus(change.path)) {
        console.log(
          '[DEPRECATION WARNING] Case status should not be updated in the general update case endpoint. Please use the dedicated endpoint for updating the case status. Support for updating case status in the general update case endpoint will be removed in HRM v1.16',
        );
        if (isCloseCase(change)) actions.push(actionsMaps.case.CLOSE_CASE);
        if (isReopenCase(change)) actions.push(actionsMaps.case.REOPEN_CASE);
        if (isCaseStatusTransition(change))
          actions.push(actionsMaps.case.CASE_STATUS_TRANSITION);
      }

      if (isPathTargetsInfo(change.path)) {
        if (isAddNote(change)) actions.push(actionsMaps.case.ADD_NOTE);
        if (isAddReferral(change)) actions.push(actionsMaps.case.ADD_REFERRAL);
        if (isAddHousehold(change)) actions.push(actionsMaps.case.ADD_HOUSEHOLD);
        if (isAddPerpetrator(change)) actions.push(actionsMaps.case.ADD_PERPETRATOR);
        if (isAddIncident(change)) actions.push(actionsMaps.case.ADD_INCIDENT);
        if (isAddDocument(change)) actions.push(actionsMaps.case.ADD_DOCUMENT);
        if (isEditCaseOverview(change)) actions.push(actionsMaps.case.EDIT_CASE_OVERVIEW);
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
