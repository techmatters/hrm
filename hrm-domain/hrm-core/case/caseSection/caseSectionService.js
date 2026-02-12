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
exports.deleteCaseSection = exports.getCaseSectionTypeList = exports.getMultipleCaseTimelines = exports.getCaseTimeline = exports.getCaseSection = exports.replaceCaseSection = exports.createCaseSection = void 0;
/**
 * This is the 'business logic' module for Case Section CRUD operations.
 */
const crypto_1 = require("crypto");
const types_1 = require("./types");
const caseSectionDataAccess_1 = require("./caseSectionDataAccess");
const types_2 = require("@tech-matters/types");
const caseService_1 = require("../caseService");
const sql_1 = require("../../sql");
const contactService_1 = require("../../contact/contactService");
const newDBErrorResult = ({ cause, error, resourceIdentifier, }) => {
    const message = `caseSection resource already exists: ${resourceIdentifier}`;
    return {
        _tag: 'Result',
        status: 'error',
        error,
        cause,
        resourceIdentifier,
        resourceType: 'caseSection',
        message,
        unwrap: () => {
            throw new Error(message);
        },
    };
};
const sectionRecordToSection = (sectionRecord) => {
    if (!sectionRecord) {
        return undefined;
    }
    const { accountSid, caseId, ...section } = sectionRecord;
    return section;
};
const createCaseSection = async (accountSid, caseId, sectionType, newSection, workerSid, skipSearchIndex = false) => {
    const nowISO = new Date().toISOString();
    const record = {
        sectionId: (0, crypto_1.randomUUID)(),
        eventTimestamp: nowISO,
        ...newSection,
        caseId: Number.parseInt(caseId),
        sectionType,
        createdBy: workerSid,
        createdAt: nowISO,
        accountSid,
    };
    const createdResult = await (0, caseSectionDataAccess_1.create)()(record);
    if ((0, types_2.isErr)(createdResult)) {
        if (createdResult.table === 'CaseSections') {
            const resourceIdentifier = `${caseId}/${sectionType}/${record.sectionId}`;
            const cause = createdResult;
            if ((0, sql_1.isDatabaseUniqueConstraintViolationErrorResult)(createdResult)) {
                return newDBErrorResult({
                    resourceIdentifier,
                    cause,
                    error: 'ResourceAlreadyExists',
                });
            }
            if ((0, sql_1.isDatabaseForeignKeyViolationErrorResult)(createdResult)) {
                return newDBErrorResult({
                    resourceIdentifier,
                    cause,
                    error: 'ForeignKeyViolation',
                });
            }
        }
        return createdResult;
    }
    if (!skipSearchIndex) {
        // trigger index operation but don't await for it
        (0, caseService_1.updateCaseNotify)({ accountSid, caseId });
    }
    return (0, types_2.newOkFromData)(sectionRecordToSection(createdResult.unwrap()));
};
exports.createCaseSection = createCaseSection;
const replaceCaseSection = async (accountSid, caseId, sectionType, sectionId, newSection, workerSid, skipSearchIndex = false) => {
    const nowISO = new Date().toISOString();
    const record = {
        ...newSection,
        updatedBy: workerSid,
        updatedAt: nowISO,
    };
    const updated = await (0, caseSectionDataAccess_1.updateById)()(accountSid, Number.parseInt(caseId), sectionType, sectionId, record);
    if (!skipSearchIndex) {
        // trigger index operation but don't await for it
        (0, caseService_1.updateCaseNotify)({ accountSid, caseId });
    }
    return sectionRecordToSection(updated);
};
exports.replaceCaseSection = replaceCaseSection;
const getCaseSection = async (accountSid, caseId, sectionType, sectionId) => {
    return sectionRecordToSection(await (0, caseSectionDataAccess_1.getById)(accountSid, Number.parseInt(caseId), sectionType, sectionId));
};
exports.getCaseSection = getCaseSection;
const getCaseTimeline = async (accountSid, { user, permissionRules, }, caseId, sectionTypes, includeContacts, { limit, offset }) => {
    const dbResult = await (0, caseSectionDataAccess_1.getTimeline)(accountSid, user, permissionRules.viewContact, [caseId], sectionTypes, includeContacts, parseInt(limit), parseInt(offset));
    return {
        ...dbResult,
        activities: dbResult.activities.map(({ caseId: _, ...event }) => {
            if ((0, types_1.isContactRecordTimelineActivity)(event)) {
                return {
                    ...event,
                    activity: (0, contactService_1.contactRecordToContact)(event.activity),
                };
            }
            else {
                return {
                    ...event,
                    activity: sectionRecordToSection(event.activity),
                };
            }
        }),
    };
};
exports.getCaseTimeline = getCaseTimeline;
const getMultipleCaseTimelines = async (accountSid, { user, permissionRules, }, caseIds, sectionTypes, includeContacts, { limit, offset }) => {
    const dbResult = await (0, caseSectionDataAccess_1.getTimeline)(accountSid, user, permissionRules.viewContact, caseIds, sectionTypes, includeContacts, parseInt(limit), parseInt(offset));
    const timelines = {};
    for (const { caseId, ...activityEntry } of dbResult.activities) {
        timelines[caseId] = timelines[caseId] || [];
        if ((0, types_1.isContactRecordTimelineActivity)(activityEntry)) {
            timelines[caseId].push({
                ...activityEntry,
                activity: (0, contactService_1.contactRecordToContact)(activityEntry.activity),
            });
        }
        else {
            timelines[caseId].push(activityEntry);
        }
    }
    return {
        count: dbResult.count,
        timelines,
    };
};
exports.getMultipleCaseTimelines = getMultipleCaseTimelines;
const getCaseSectionTypeList = async (accountSid, req, caseId, sectionType) => (await (0, exports.getCaseTimeline)(accountSid, req, caseId, [sectionType], false, {
    limit: '1000',
    offset: '0',
})).activities.map(event => sectionRecordToSection(event.activity));
exports.getCaseSectionTypeList = getCaseSectionTypeList;
const deleteCaseSection = async (accountSid, caseId, sectionType, sectionId, { user }, skipSearchIndex = false) => {
    const deleted = await (0, caseSectionDataAccess_1.deleteById)()(accountSid, Number.parseInt(caseId), sectionType, sectionId, user.workerSid);
    if (!skipSearchIndex) {
        // trigger index operation but don't await for it
        (0, caseService_1.updateCaseNotify)({ accountSid, caseId });
    }
    return sectionRecordToSection(deleted);
};
exports.deleteCaseSection = deleteCaseSection;
