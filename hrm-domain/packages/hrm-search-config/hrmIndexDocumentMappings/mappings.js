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
exports.caseMapping = exports.caseSectionMapping = exports.casePathToSections = exports.casePathToContacts = exports.contactMapping = void 0;
// Properties present in root and nested documents
const commonProperties = {
    accountSid: {
        type: 'keyword',
    },
    createdBy: {
        type: 'keyword',
    },
    updatedBy: {
        type: 'keyword',
    },
    createdAt: {
        type: 'date',
    },
    updatedAt: {
        type: 'date',
    },
    content: {
        type: 'text',
    },
};
// Properties shared by both types of documents, cases and contacts
const rootProperties = {
    id: {
        type: 'keyword',
    },
    twilioWorkerId: {
        type: 'keyword',
    },
    helpline: {
        type: 'keyword',
    },
    ...commonProperties,
};
// Properties specific to contacts
exports.contactMapping = {
    ...rootProperties,
    number: {
        type: 'keyword',
    },
    channel: {
        type: 'keyword',
    },
    finalized: {
        type: 'boolean',
    },
    timeOfContact: {
        type: 'date',
    },
    transcript: {
        type: 'text',
    },
    isDataContact: {
        type: 'boolean',
    },
};
exports.casePathToContacts = 'contacts';
exports.casePathToSections = 'sections';
// Properties specific to case serctions
exports.caseSectionMapping = {
    sectionType: {
        type: 'keyword',
    },
    sectionId: {
        type: 'keyword',
    },
    ...commonProperties,
};
// Properties specific to cases
exports.caseMapping = {
    ...rootProperties,
    status: {
        type: 'keyword',
    },
    statusUpdatedAt: {
        type: 'date',
    },
    statusUpdatedBy: {
        type: 'keyword',
    },
    previousStatus: {
        type: 'keyword',
    },
    [exports.casePathToSections]: {
        type: 'nested',
        properties: exports.caseSectionMapping,
    },
    [exports.casePathToContacts]: {
        type: 'nested',
        properties: exports.contactMapping,
    },
};
