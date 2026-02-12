"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSetOfActionsForTarget = exports.isTargetKind = exports.actionsMaps = void 0;
exports.actionsMaps = {
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
        EDIT_CONTACT_FIELD: 'editContactField',
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
};
const isTargetKind = (s) => Boolean(exports.actionsMaps[s]);
exports.isTargetKind = isTargetKind;
const isValidSetOfActionsForTarget = (targetKind, actions) => {
    const validActionsOnTarget = Object.values(exports.actionsMaps[targetKind]);
    return (Array.isArray(actions) &&
        exports.actionsMaps[targetKind] &&
        actions.every(action => validActionsOnTarget.includes(action)));
};
exports.isValidSetOfActionsForTarget = isValidSetOfActionsForTarget;
