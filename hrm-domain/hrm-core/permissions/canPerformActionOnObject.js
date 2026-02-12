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
exports.isValidFileLocation = exports.isFilesRelatedAction = exports.canPerformActionsOnObject = void 0;
const actions_1 = require("./actions");
const contactService_1 = require("../contact/contactService");
const caseService_1 = require("../case/caseService");
const types_1 = require("@tech-matters/types");
const conversationMedia_1 = require("../conversation-media/conversationMedia");
const types_2 = require("@tech-matters/types");
const canPerformActionsOnObject = async ({ hrmAccountId, targetKind, actions, objectId, can, user, }) => {
    try {
        if (!(0, actions_1.isValidSetOfActionsForTarget)(targetKind, actions)) {
            return (0, types_2.newErr)({
                message: 'invalid actions for objectType',
                error: 'InvalidObjectType',
                extraProperties: {
                    targetKind,
                    actions,
                },
            });
        }
        switch (targetKind) {
            case 'contact': {
                const object = await (0, contactService_1.getContactById)(hrmAccountId, objectId, { can, user });
                const canPerform = actions.every(action => can(user, action, object));
                return (0, types_2.newOk)({ data: canPerform });
            }
            case 'contactField': {
                return (0, types_2.newErr)({
                    message: 'Not Implemented',
                    error: 'InternalServerError',
                    extraProperties: {
                        errorObject: new Error('Not Implemented'),
                    },
                });
            }
            case 'case': {
                const object = await (0, caseService_1.getCase)(objectId, hrmAccountId, {
                    user,
                });
                const canPerform = actions.every(action => can(user, action, object));
                return (0, types_2.newOk)({ data: canPerform });
            }
            case 'profile': {
                return (0, types_2.newErr)({
                    message: 'Not Implemented',
                    error: 'InternalServerError',
                    extraProperties: {
                        errorObject: new Error('Not Implemented'),
                    },
                });
            }
            case 'profileSection': {
                return (0, types_2.newErr)({
                    message: 'Not Implemented',
                    error: 'InternalServerError',
                    extraProperties: {
                        errorObject: new Error('Not Implemented'),
                    },
                });
            }
            case 'postSurvey': {
                // Nothing from the target param is being used for postSurvey target kind, we can pass null for now
                const canPerform = actions.every(action => can(user, action, null));
                return (0, types_2.newOk)({ data: canPerform });
            }
            default: {
                (0, types_1.assertExhaustive)(targetKind);
            }
        }
    }
    catch (err) {
        const error = err;
        return (0, types_2.newErr)({
            message: error.message,
            error: 'InternalServerError',
            extraProperties: {
                errorObject: error,
            },
        });
    }
};
exports.canPerformActionsOnObject = canPerformActionsOnObject;
const isFilesRelatedAction = (targetKind, action) => {
    switch (targetKind) {
        case 'contact': {
            return action === 'viewExternalTranscript' || action === 'viewRecording';
        }
        case 'case':
        case 'contactField':
        case 'profile':
        case 'profileSection':
        case 'postSurvey': {
            return false;
        }
        default: {
            (0, types_1.assertExhaustive)(targetKind);
        }
    }
};
exports.isFilesRelatedAction = isFilesRelatedAction;
const isValidFileLocation = async ({ hrmAccountId, targetKind, objectId, bucket, key, }) => {
    try {
        switch (targetKind) {
            case 'contact': {
                const conversationMedia = await (0, conversationMedia_1.getConversationMediaByContactId)(hrmAccountId, parseInt(objectId));
                const isValid = conversationMedia.some(cm => (0, conversationMedia_1.isS3StoredConversationMedia)(cm) &&
                    cm.storeTypeSpecificData?.location?.bucket === bucket &&
                    cm.storeTypeSpecificData?.location?.key === key);
                return (0, types_2.newOk)({ data: isValid });
            }
            case 'case':
            case 'contactField':
            case 'profile':
            case 'profileSection':
            case 'postSurvey': {
                return (0, types_2.newOk)({ data: false });
            }
            default: {
                (0, types_1.assertExhaustive)(targetKind);
            }
        }
    }
    catch (error) {
        return (0, types_2.newErr)({
            message: error.message,
            error: 'InternalServerError',
        });
    }
};
exports.isValidFileLocation = isValidFileLocation;
