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
exports.verifyAddSectionRequest = void 0;
const node_assert_1 = require("node:assert");
const verifyAddSectionRequest = (caseId, caseSectionType, expectedCaseSection, firstRequest = true) => {
    const mockFetch = global.fetch;
    expect(mockFetch.mock.calls.length).toBeGreaterThan(firstRequest ? 0 : 1);
    const [firstCall, ...subsequentCalls] = mockFetch.mock.calls;
    const callsToCheck = firstRequest ? [firstCall] : subsequentCalls;
    const call = callsToCheck.find(([url, options]) => url ===
        `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/${caseId}/sections/${caseSectionType}` &&
        JSON.parse(options.body.toString()).sectionId === expectedCaseSection.sectionId);
    if (!call) {
        throw new node_assert_1.AssertionError({
            message: `Expected request to ${caseSectionType} section not found`,
            actual: mockFetch.mock.calls,
        });
    }
    expect(call[1]).toStrictEqual({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${process.env.STATIC_KEY}`,
        },
        body: expect.any(String),
    });
    let parsedJson = JSON.parse(call[1].body);
    expect(parsedJson).toStrictEqual(expectedCaseSection);
};
exports.verifyAddSectionRequest = verifyAddSectionRequest;
