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
exports.wasPendingIncidentCreated = exports.getOrCreateCase = exports.updateAttemptCaseSection = exports.createAttemptCaseSection = void 0;
const caseService_1 = require("./caseService");
const contactService_1 = require("./contactService");
const types_1 = require("@tech-matters/types");
const sectionType = 'dispatchAttempt';
const createAttemptCaseSection = async ({ accountSid, caseId, baseUrl, staticKey, }) => {
    try {
        const sectionTypeSpecificData = {
            attemptTimestamp: new Date().toISOString(),
            createdTimestamp: null,
            incidentId: null,
        };
        const createSectionResult = await (0, caseService_1.createCaseSection)({
            accountSid,
            caseId,
            sectionType,
            sectionTypeSpecificData,
            baseUrl,
            staticKey,
        });
        if ((0, types_1.isErr)(createSectionResult)) {
            return createSectionResult;
        }
        return (0, types_1.newOk)({ data: { caseSection: createSectionResult.data } });
    }
    catch (error) {
        return (0, types_1.newErr)({
            error,
            message: `Unexpected error ${error instanceof Error ? error.message : String(error)}`,
        });
    }
};
exports.createAttemptCaseSection = createAttemptCaseSection;
const recordAttemptAndGetTimeline = async ({ accountSid, caseId, baseUrl, staticKey, }) => {
    try {
        // record a new attempt
        const createSectionResult = await (0, exports.createAttemptCaseSection)({
            accountSid,
            baseUrl,
            caseId,
            staticKey,
        });
        if ((0, types_1.isErr)(createSectionResult)) {
            return createSectionResult;
        }
        // get the entire timeline
        const sectionsResult = await (0, caseService_1.getCaseSections)({
            accountSid,
            baseUrl,
            caseId,
            sectionType,
            staticKey,
        });
        if ((0, types_1.isErr)(sectionsResult)) {
            return sectionsResult;
        }
        return (0, types_1.newOk)({
            data: { sections: sectionsResult.data, currentAttempt: createSectionResult.data },
        });
    }
    catch (error) {
        return (0, types_1.newErr)({
            error,
            message: `Unexpected error ${error instanceof Error ? error.message : String(error)}`,
        });
    }
};
const updateAttemptCaseSection = async ({ accountSid, caseId, beaconIncidentId, attemptSection, baseUrl, staticKey, }) => {
    try {
        const sectionTypeSpecificData = {
            attemptTimestamp: attemptSection.sectionTypeSpecificData.attemptTimestamp,
            createdTimestamp: new Date().toISOString(),
            incidentId: beaconIncidentId,
        };
        const updateSectionResult = await (0, caseService_1.updateCaseSection)({
            accountSid,
            caseId,
            sectionId: attemptSection.sectionId,
            sectionType,
            sectionTypeSpecificData,
            baseUrl,
            staticKey,
        });
        if ((0, types_1.isErr)(updateSectionResult)) {
            return updateSectionResult;
        }
        return (0, types_1.newOk)({ data: { caseSection: updateSectionResult.data } });
    }
    catch (error) {
        return (0, types_1.newErr)({
            error,
            message: `Unexpected error ${error instanceof Error ? error.message : String(error)}`,
        });
    }
};
exports.updateAttemptCaseSection = updateAttemptCaseSection;
const getOrCreateCase = async ({ accountSid, casePayload, contactId, baseUrl, staticKey, }) => {
    try {
        // get contact and check for existence of an associated case
        const contactResult = await (0, contactService_1.getContact)({ accountSid, contactId, baseUrl, staticKey });
        if ((0, types_1.isErr)(contactResult)) {
            return contactResult;
        }
        if (contactResult.data.caseId) {
            const caseResult = await (0, caseService_1.getCase)({
                accountSid,
                caseId: contactResult.data.caseId,
                baseUrl,
                staticKey,
            });
            if ((0, types_1.isErr)(caseResult)) {
                return caseResult;
            }
            console.info(`Case exists: ${JSON.stringify(caseResult)}`);
            const sectionsResult = await recordAttemptAndGetTimeline({
                accountSid,
                baseUrl,
                caseId: caseResult.data.id,
                staticKey,
            });
            if ((0, types_1.isErr)(sectionsResult)) {
                return sectionsResult;
            }
            return (0, types_1.newOk)({
                data: {
                    caseObj: caseResult.data,
                    contact: contactResult.data,
                    sections: sectionsResult.data,
                },
            });
        }
        // no case associated, create and associate one
        const caseResult = await (0, caseService_1.createCase)({ accountSid, casePayload, baseUrl, staticKey });
        if ((0, types_1.isErr)(caseResult)) {
            return caseResult;
        }
        console.info(`Case created: ${JSON.stringify(caseResult)}`);
        const caseObj = caseResult.data;
        const caseId = caseObj.id.toString();
        const connectedResult = await (0, contactService_1.connectToCase)({
            accountSid,
            caseId,
            contactId,
            baseUrl,
            staticKey,
        });
        if ((0, types_1.isErr)(connectedResult)) {
            await (0, caseService_1.deleteCase)({ accountSid, baseUrl, caseId: caseObj.id, staticKey });
            return connectedResult;
        }
        // record a new attempt
        const createSectionResult = await (0, exports.createAttemptCaseSection)({
            accountSid,
            baseUrl,
            caseId: caseResult.data.id,
            staticKey,
        });
        if ((0, types_1.isErr)(createSectionResult)) {
            return createSectionResult;
        }
        const sectionsResult = await recordAttemptAndGetTimeline({
            accountSid,
            baseUrl,
            caseId: caseResult.data.id,
            staticKey,
        });
        if ((0, types_1.isErr)(sectionsResult)) {
            return sectionsResult;
        }
        return (0, types_1.newOk)({
            data: {
                caseObj: caseResult.data,
                contact: contactResult.data,
                sections: sectionsResult.data,
            },
        });
    }
    catch (error) {
        return (0, types_1.newErr)({
            error,
            message: `Unexpected error ${error instanceof Error ? error.message : String(error)}`,
        });
    }
};
exports.getOrCreateCase = getOrCreateCase;
const wasPendingIncidentCreated = (timeline) => Boolean(timeline.activities.length) &&
    timeline.activities.some(t => t.activity.sectionTypeSpecificData?.incidentId !== null);
exports.wasPendingIncidentCreated = wasPendingIncidentCreated;
