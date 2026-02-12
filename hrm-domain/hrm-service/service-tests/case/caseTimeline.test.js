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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("../server");
const mocks_1 = require("../mocks");
const caseService_1 = require("@tech-matters/hrm-core/case/caseService");
const types_1 = require("@tech-matters/hrm-core/case/caseSection/types");
const jest_each_1 = __importDefault(require("jest-each"));
const caseSectionService_1 = require("@tech-matters/hrm-core/case/caseSection/caseSectionService");
const date_fns_1 = require("date-fns");
const contactService_1 = require("@tech-matters/hrm-core/contact/contactService");
const setupServiceTest_1 = require("../setupServiceTest");
const { request } = (0, setupServiceTest_1.setupServiceTests)(mocks_1.workerSid);
const BASELINE_DATE = new Date(2000, 0, 1);
let sampleCase;
let expectedContacts;
const definitionVersion = 'as-v1';
beforeEach(async () => {
    sampleCase = await (0, caseService_1.createCase)({ definitionVersion }, mocks_1.accountSid, mocks_1.workerSid, undefined, true);
    const sampleSections = {
        sectionType1: [
            {
                sectionTypeSpecificData: {
                    text: 'Type 1, Item 1',
                },
                eventTimestamp: BASELINE_DATE.toISOString(),
            },
            {
                sectionTypeSpecificData: {
                    text: 'Type 1, Item 2',
                },
                eventTimestamp: (0, date_fns_1.addDays)(BASELINE_DATE, 1).toISOString(),
            },
            {
                sectionTypeSpecificData: {
                    text: 'Type 1, Item 3',
                },
                eventTimestamp: (0, date_fns_1.addDays)(BASELINE_DATE, 2).toISOString(),
            },
        ],
        sectionType2: [
            {
                sectionTypeSpecificData: {
                    text: 'Type 2, Item 1',
                },
                eventTimestamp: (0, date_fns_1.addHours)(BASELINE_DATE, 6).toISOString(),
            },
            {
                sectionTypeSpecificData: {
                    text: 'Type 2, Item 2',
                },
                eventTimestamp: (0, date_fns_1.addHours)((0, date_fns_1.addDays)(BASELINE_DATE, 1), 6).toISOString(),
            },
            {
                sectionTypeSpecificData: {
                    text: 'Type 2, Item 3',
                },
                eventTimestamp: (0, date_fns_1.addHours)((0, date_fns_1.addDays)(BASELINE_DATE, 2), 6).toISOString(),
            },
        ],
    };
    await Promise.all(Object.entries(sampleSections).flatMap(([sectionType, newSections]) => newSections.map(ns => (0, caseSectionService_1.createCaseSection)(mocks_1.accountSid, sampleCase.id.toString(), sectionType, ns, mocks_1.workerSid, true))));
    const sampleContacts = [
        {
            ...mocks_1.contact1,
            timeOfContact: (0, date_fns_1.addHours)(BASELINE_DATE, 3).toISOString(),
            helpline: 'Contact 1 Helpline',
        },
        {
            ...mocks_1.contact2,
            timeOfContact: (0, date_fns_1.addDays)((0, date_fns_1.addHours)(BASELINE_DATE, 3), 1).toISOString(),
            helpline: 'Contact 2 Helpline',
        },
        {
            ...mocks_1.another2,
            timeOfContact: (0, date_fns_1.addDays)((0, date_fns_1.addHours)(BASELINE_DATE, 3), 2).toISOString(),
            helpline: 'Contact 3 Helpline',
        },
    ];
    expectedContacts = (await Promise.all(sampleContacts.map(async (c) => {
        const created = await (0, contactService_1.createContact)(mocks_1.accountSid, mocks_1.workerSid, c, mocks_1.ALWAYS_CAN, true);
        return (0, contactService_1.connectContactToCase)(mocks_1.accountSid, created.id.toString(), sampleCase.id.toString(), mocks_1.ALWAYS_CAN, true);
    })))
        .sort((a, b) => (0, date_fns_1.parseISO)(a.timeOfContact).valueOf() - (0, date_fns_1.parseISO)(b.timeOfContact).valueOf())
        .map(c => {
        const { totalCount, conversationMedia, csamReports, referrals, ...contact } = c;
        return {
            ...contact,
            timeOfContact: expect.toParseAsDate(contact.timeOfContact),
            createdAt: expect.toParseAsDate(contact.createdAt),
            updatedAt: expect.toParseAsDate(contact.updatedAt),
        };
    });
});
const getRoutePath = (caseId, sectionTypes, includeContacts, offset, limit) => `/v0/accounts/${mocks_1.accountSid}/cases/${caseId}/timeline?sectionTypes=${sectionTypes.join(',')}&includeContacts=${includeContacts}${typeof limit === 'number' ? `&limit=${limit}` : ''}${typeof offset === 'number' ? `&offset=${offset}` : ''}`;
describe('GET /cases/:caseId/timeline', () => {
    test('should return 401 if valid auth headers are not set', async () => {
        const response = await request.get(getRoutePath(sampleCase.id, ['sectionType1'], false));
        expect(response.status).toBe(401);
    });
    test("should return 404 if case doesn't exist", async () => {
        const response = await request
            .post(getRoutePath(sampleCase.id + 1, ['sectionType1'], false))
            .set(server_1.headers);
        expect(response.status).toBe(404);
    });
    const testCases = [
        {
            description: 'All sections and include contacts - returns everything',
            includeContacts: true,
            sectionTypes: ['sectionType1', 'sectionType2'],
            expectedActivityDescriptions: [
                'Type 2, Item 3',
                'Contact 3 Helpline',
                'Type 1, Item 3',
                'Type 2, Item 2',
                'Contact 2 Helpline',
                'Type 1, Item 2',
                'Type 2, Item 1',
                'Contact 1 Helpline',
                'Type 1, Item 1',
            ],
            expectedTotalCount: 9,
        },
        {
            description: 'All sections and exclude contacts - returns all sections',
            includeContacts: false,
            sectionTypes: ['sectionType1', 'sectionType2'],
            expectedActivityDescriptions: [
                'Type 2, Item 3',
                'Type 1, Item 3',
                'Type 2, Item 2',
                'Type 1, Item 2',
                'Type 2, Item 1',
                'Type 1, Item 1',
            ],
            expectedTotalCount: 6,
        },
        {
            description: 'Partial sections and include contacts - returns specified sections & contacts',
            includeContacts: true,
            sectionTypes: ['sectionType2'],
            expectedActivityDescriptions: [
                'Type 2, Item 3',
                'Contact 3 Helpline',
                'Type 2, Item 2',
                'Contact 2 Helpline',
                'Type 2, Item 1',
                'Contact 1 Helpline',
            ],
            expectedTotalCount: 6,
        },
        {
            description: 'Pagination - returns correct slice of results and accurate total count',
            includeContacts: true,
            sectionTypes: ['sectionType2'],
            offset: 2,
            limit: 3,
            expectedActivityDescriptions: [
                'Type 2, Item 2',
                'Contact 2 Helpline',
                'Type 2, Item 1',
            ],
            expectedTotalCount: 6,
        },
    ];
    (0, jest_each_1.default)(testCases).test('$description', async ({ sectionTypes, includeContacts, expectedActivityDescriptions, expectedTotalCount, offset, limit, }) => {
        const response = await request
            .get(getRoutePath(sampleCase.id, sectionTypes, includeContacts, offset, limit))
            .set(server_1.headers);
        expect(response.status).toBe(200);
        const { count, activities, } = response.body;
        const activityDescriptions = activities.map(ev => (0, types_1.isCaseSectionTimelineActivity)(ev)
            ? ev.activity.sectionTypeSpecificData.text
            : ev.activity.helpline);
        expect(activityDescriptions).toStrictEqual(expectedActivityDescriptions);
        const activityContacts = activities
            .filter(ev => !(0, types_1.isCaseSectionTimelineActivity)(ev))
            .map(ev => ev.activity);
        expect(count).toBe(expectedTotalCount);
        activityContacts.forEach(ec => {
            const expectedContact = expectedContacts.find(expected => expected.id === ec.id);
            expect(ec).toStrictEqual(expectedContact);
        });
    });
});
