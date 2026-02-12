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
const caseUpdater_1 = require("../../src/caseUpdater");
const types_1 = require("@tech-matters/types");
const node_assert_1 = require("node:assert");
const mockFetch = jest.fn();
global.fetch = mockFetch;
const verifyAddSectionRequest = (caseId, expectedCaseSection) => {
    expect(mockFetch).toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/${caseId}/sections/chicken`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${process.env.STATIC_KEY}`,
        },
        body: JSON.stringify(expectedCaseSection),
    });
};
beforeEach(async () => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'OK' }),
    });
});
describe('addSectionToAseloCase', () => {
    const chickenAdder = (0, caseUpdater_1.addSectionToAseloCase)('chicken', (chicken) => {
        return {
            caseId: chicken.case_id,
            section: {
                sectionId: chicken.id,
                sectionTypeSpecificData: {
                    boc: chicken.boc,
                },
            },
            lastUpdated: chicken.chicken_counter.toString(),
        };
    });
    test('creates an Aselo case section from source data using the mapper provided and adds it to the case via the HRM API, returning the updated last_seen', async () => {
        const result = await chickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        }, '40');
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
        if ((0, types_1.isOk)(result)) {
            expect(result.unwrap()).toEqual('42');
        }
        else
            throw new node_assert_1.AssertionError({ message: 'Did not expect error', actual: result });
    });
    test('Service responds with 409 - returns warn level error result', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => 'Already exists',
        });
        const result = await chickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        }, '40');
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'warn',
                caseId: '1234',
                lastUpdated: '42',
                sectionId: '5678',
                type: 'SectionExists',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
    });
    test('Service responds with 404 - returns warn level error result', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            text: async () => 'No case',
        });
        const result = await chickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        }, '40');
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'warn',
                caseId: '1234',
                lastUpdated: '42',
                sectionId: '5678',
                type: 'CaseNotFound',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
    });
    test('Service responds with 500 - returns error level error result', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'No case',
        });
        const result = await chickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        }, '40');
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'error',
                status: 500,
                lastUpdated: '42',
                type: 'UnexpectedHttpError',
                body: 'No case',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
    });
    test('No case id provided - returns error without requesting', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'No case',
        });
        const result = await chickenAdder({
            case_id: undefined,
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        }, '40');
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'error',
                lastUpdated: '42',
                sectionId: '5678',
                type: 'CaseNotSpecified',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        expect(mockFetch).not.toHaveBeenCalled();
    });
    test('Last updated value equals last seen value - skips, returning ok result without adding a section', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => 'No case',
        });
        const result = await chickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        }, '42');
        if ((0, types_1.isOk)(result)) {
            expect(result.data).toEqual('42');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Did not expect error', actual: result });
        }
        expect(mockFetch).not.toHaveBeenCalled();
    });
    test('Error caused by something other than HTTP response code', async () => {
        const thrownError = new Error('boom');
        mockFetch.mockImplementation(() => {
            throw thrownError;
        });
        const result = await chickenAdder({
            case_id: 'boc',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        }, '40');
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'error',
                thrownError,
                type: 'UnexpectedError',
            });
            expect(result.message).toEqual('boom');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
    });
});
describe('addDependentSectionToAseloCase', () => {
    const dependentChickenAdder = (0, caseUpdater_1.addDependentSectionToAseloCase)('chicken', (chicken) => {
        return {
            caseId: chicken.case_id,
            section: {
                sectionId: chicken.id,
                sectionTypeSpecificData: {
                    boc: chicken.boc,
                },
            },
        };
    });
    test('creates an Aselo case section from source data using the mapper provided and adds it to the case via the HRM API', async () => {
        const result = await dependentChickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        });
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
        if ((0, types_1.isOk)(result)) {
            expect(result.unwrap()).not.toBeDefined();
        }
        else
            throw new node_assert_1.AssertionError({ message: 'Did not expect error', actual: result });
    });
    test('Service responds with 409 - returns warn level error result', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => 'Already exists',
        });
        const result = await dependentChickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        });
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'warn',
                caseId: '1234',
                sectionId: '5678',
                type: 'SectionExists',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
    });
    test('Service responds with 404 - returns warn level error result', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            text: async () => 'No case',
        });
        const result = await dependentChickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        });
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'warn',
                caseId: '1234',
                sectionId: '5678',
                type: 'CaseNotFound',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
    });
    test('Service responds with 500 - returns error level error result', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'No case',
        });
        const result = await dependentChickenAdder({
            case_id: '1234',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        });
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'error',
                status: 500,
                type: 'UnexpectedHttpError',
                body: 'No case',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        verifyAddSectionRequest('1234', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                boc: 'bocARGGH',
            },
        });
    });
    test('No case id provided - returns error without requesting', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'No case',
        });
        const result = await dependentChickenAdder({
            case_id: undefined,
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        });
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'error',
                sectionId: '5678',
                type: 'CaseNotSpecified',
            });
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
        expect(mockFetch).not.toHaveBeenCalled();
    });
    test('Error caused by something other than HTTP response code', async () => {
        const thrownError = new Error('boom');
        mockFetch.mockImplementation(() => {
            throw thrownError;
        });
        const result = await dependentChickenAdder({
            case_id: 'boc',
            id: '5678',
            boc: 'bocARGGH',
            chicken_counter: 42,
        });
        if ((0, types_1.isErr)(result)) {
            expect(result.error).toEqual({
                level: 'error',
                thrownError,
                type: 'UnexpectedError',
            });
            expect(result.message).toEqual('boom');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error', actual: result });
        }
    });
});
