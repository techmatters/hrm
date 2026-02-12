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
exports.createMockCase = exports.createMockCaseInsert = exports.createMockCaseRecord = void 0;
const mocks_1 = require("../mocks");
const baselineDate = new Date(2000, 5, 1);
const createMockCaseRecord = (partial) => {
    return Object.assign({
        label: 'case1 label',
        id: 1,
        definitionVersion: 'as-v1',
        helpline: 'helpline',
        status: 'open',
        info: {},
        twilioWorkerId: 'WK-twilio-worker-id',
        createdBy: mocks_1.workerSid,
        accountSid: 'ACCOUNT_SID',
        createdAt: baselineDate.toISOString(),
        updatedAt: baselineDate.toISOString(),
        updatedBy: null,
        statusUpdatedAt: null,
        statusUpdatedBy: null,
        caseSections: [
            {
                accountSid: 'ACCOUNT_SID',
                caseId: 1,
                sectionType: 'note',
                sectionId: 'NOTE_1',
                createdBy: 'WK-contact-adder',
                createdAt: baselineDate.toISOString(),
                eventTimestamp: baselineDate.toISOString(),
                sectionTypeSpecificData: { note: 'Child with covid-19' },
            },
        ],
    }, partial);
};
exports.createMockCaseRecord = createMockCaseRecord;
const createMockCaseInsert = (partial) => {
    return Object.assign({
        ...(0, exports.createMockCaseRecord)({}),
    }, partial);
};
exports.createMockCaseInsert = createMockCaseInsert;
const createMockCase = (partial) => {
    return Object.assign((0, exports.createMockCaseRecord)({}), partial);
};
exports.createMockCase = createMockCase;
