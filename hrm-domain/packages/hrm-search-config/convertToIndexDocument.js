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
exports.convertToIndexDocument = exports.convertContactToContactDocument = void 0;
const hrmIndexDocumentMappings_1 = require("./hrmIndexDocumentMappings");
const hrm_types_1 = require("@tech-matters/hrm-types");
const filterUndefined = (doc) => Object.entries(doc).reduce((accum, [key, value]) => {
    if (value === undefined) {
        return accum;
    }
    return { ...accum, [key]: value };
}, {});
const convertContactToContactDocument = ({ contact, transcript, }) => {
    const { accountSid, id, createdAt, createdBy, updatedAt, updatedBy, finalizedAt, helpline, number, channel, timeOfContact, twilioWorkerId, rawJson, } = contact;
    const contactDocument = {
        accountSid,
        id: id.toString(),
        createdAt,
        updatedAt,
        createdBy,
        updatedBy,
        finalized: Boolean(finalizedAt),
        helpline,
        channel,
        number,
        timeOfContact,
        transcript,
        twilioWorkerId,
        content: JSON.stringify(rawJson),
        isDataContact: Boolean(rawJson) && Object.values(hrm_types_1.dataCallTypes).includes(rawJson.callType),
        // high_boost_global: '', // highBoostGlobal.join(' '),
        // low_boost_global: '', // lowBoostGlobal.join(' '),
    };
    return filterUndefined(contactDocument);
};
exports.convertContactToContactDocument = convertContactToContactDocument;
const convertCaseToCaseDocument = ({ case: caseObj, }) => {
    const { accountSid, id, createdAt, createdBy, updatedAt, updatedBy, helpline, twilioWorkerId, previousStatus, status, statusUpdatedAt, statusUpdatedBy, sections, info, } = caseObj;
    const mappedSections = Object.entries(sections ?? {}).flatMap(([sectionType, sectionsArray]) => sectionsArray.map(section => ({
        accountSid: accountSid,
        createdAt: section.createdAt,
        createdBy: section.createdBy,
        updatedAt: section.updatedAt,
        updatedBy: section.updatedBy,
        sectionId: section.sectionId,
        sectionType,
        content: typeof section.sectionTypeSpecificData === 'object'
            ? JSON.stringify(section.sectionTypeSpecificData)
            : section.sectionTypeSpecificData,
    })));
    const caseDocument = {
        accountSid,
        id: id.toString(),
        createdAt,
        updatedAt,
        createdBy,
        updatedBy,
        helpline,
        twilioWorkerId,
        status,
        previousStatus,
        statusUpdatedAt,
        statusUpdatedBy,
        content: JSON.stringify(info),
        sections: mappedSections,
        contacts: undefined,
        // high_boost_global: '', // highBoostGlobal.join(' '),
        // low_boost_global: '', // lowBoostGlobal.join(' '),
    };
    return filterUndefined(caseDocument);
};
const convertToContactIndexDocument = (payload) => {
    if (payload.entityType === 'contact') {
        return (0, exports.convertContactToContactDocument)(payload);
    }
    throw new Error(`convertToContactIndexDocument not implemented for type ${payload.entityType} and operation ${payload.operation}`);
};
const convertToCaseIndexDocument = (payload) => {
    if (payload.entityType === 'case') {
        return convertCaseToCaseDocument(payload);
    }
    throw new Error(`convertToCaseIndexDocument not implemented for type ${payload.entityType} and operation ${payload.operation}`);
};
const convertToIndexDocument = (payload, indexName) => {
    if ((0, hrmIndexDocumentMappings_1.isHrmContactsIndex)(indexName)) {
        return convertToContactIndexDocument(payload);
    }
    if ((0, hrmIndexDocumentMappings_1.isHrmCasesIndex)(indexName)) {
        return convertToCaseIndexDocument(payload);
    }
    throw new Error(`convertToIndexDocument not implemented for index ${indexName}`);
};
exports.convertToIndexDocument = convertToIndexDocument;
