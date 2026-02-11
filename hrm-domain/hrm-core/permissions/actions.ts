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

import type { Contact } from '../contact/contactDataAccess';
import type { CaseService } from '../case/caseService';
import type {
  ProfileSection,
  ProfileWithRelationships,
} from '../profile/profileDataAccess';
import type { PostSurvey } from '../post-survey/postSurveyDataAccess';

export const actionsMaps = {
  case: {
    VIEW_CASE: 'viewCase',
    CLOSE_CASE: 'closeCase',
    REOPEN_CASE: 'reopenCase',
    CASE_STATUS_TRANSITION: 'caseStatusTransition',
    ADD_CASE_SECTION: 'addCaseSection',
    EDIT_CASE_SECTION: 'editCaseSection',
    EDIT_CASE_OVERVIEW: 'editCaseOverview',
    UPDATE_CASE_CONTACTS: 'updateCaseContacts',
  },
  contact: {
    VIEW_CONTACT: 'viewContact',
    EDIT_CONTACT: 'editContact',
    EDIT_INPROGRESS_CONTACT: 'editInProgressContact',
    VIEW_EXTERNAL_TRANSCRIPT: 'viewExternalTranscript',
    VIEW_RECORDING: 'viewRecording',
    ADD_CONTACT_TO_CASE: 'addContactToCase',
    REMOVE_CONTACT_FROM_CASE: 'removeContactFromCase',
  },
  contactField: {
    VIEW_CONTACT_FIELD: 'viewContactField',
    UPDATE_CONTACT_FIELD: 'updateContactField',
  },
  profile: {
    VIEW_PROFILE: 'viewProfile',
    // EDIT_PROFILE: 'editProfile', // we don't need edit for now, will be needed when users can attach more identifiers or edit the name
    FLAG_PROFILE: 'flagProfile',
    UNFLAG_PROFILE: 'unflagProfile',
  },
  profileSection: {
    CREATE_PROFILE_SECTION: 'createProfileSection',
    VIEW_PROFILE_SECTION: 'viewProfileSection',
    EDIT_PROFILE_SECTION: 'editProfileSection',
  },
  postSurvey: {
    VIEW_POST_SURVEY: 'viewPostSurvey',
  },
} as const;

export type TargetKind = keyof typeof actionsMaps;
export const isTargetKind = (s: string): s is TargetKind => Boolean(actionsMaps[s]);

export type ActionsForTK<T extends TargetKind> =
  (typeof actionsMaps)[T][keyof (typeof actionsMaps)[T]];

export type Target<T extends TargetKind> = {
  contact: Contact;
  contactField: Contact;
  case: CaseService;
  profile: ProfileWithRelationships;
  profileSection: ProfileSection;
  postSurvey: PostSurvey;
}[T];

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
