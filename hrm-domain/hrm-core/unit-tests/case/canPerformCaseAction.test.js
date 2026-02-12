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
const http_errors_1 = __importDefault(require("http-errors"));
const caseService_1 = require("../../case/caseService");
const permissions_1 = require("../../permissions");
const canPerformCaseAction_1 = require("../../case/canPerformCaseAction");
const jest_each_1 = __importDefault(require("jest-each"));
jest.mock('http-errors', () => jest.fn());
jest.mock('../../case/caseService', () => ({
    getCase: jest.fn(),
}));
const mockGetCase = caseService_1.getCase;
const mockCreateError = http_errors_1.default;
let req;
const next = jest.fn();
beforeEach(() => {
    req = {
        isPermitted: jest.fn().mockReturnValue(false),
        params: { contactId: 'contact1' },
        permit: jest.fn(),
        block: jest.fn(),
        can: jest.fn(),
        user: { workerSid: 'worker1' },
        accountSid: 'account1',
        body: {},
    };
    next.mockClear();
    mockCreateError.mockClear();
    mockGetCase.mockClear();
});
describe('canViewCase', () => {
    test('Case not found - throws 404', async () => {
        mockGetCase.mockResolvedValueOnce(undefined);
        await (0, canPerformCaseAction_1.canViewCase)(req, {}, next);
        expect(http_errors_1.default).toHaveBeenCalled();
        expect(req.permit).not.toHaveBeenCalled();
        expect(req.block).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
    test('Case found & can returns true - permits', async () => {
        const caseObj = {};
        mockGetCase.mockResolvedValueOnce(caseObj);
        req.can.mockReturnValueOnce(true);
        await (0, canPerformCaseAction_1.canViewCase)(req, {}, next);
        expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.case.VIEW_CASE, caseObj);
        expect(http_errors_1.default).not.toHaveBeenCalled();
        expect(req.permit).toHaveBeenCalled();
        expect(req.block).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
    test('Case found & can returns false - not found', async () => {
        const caseObj = {};
        mockGetCase.mockResolvedValueOnce(caseObj);
        req.can.mockReturnValueOnce(false);
        await (0, canPerformCaseAction_1.canViewCase)(req, {}, next);
        expect(req.can).toHaveBeenCalledWith(req.user, permissions_1.actionsMaps.case.VIEW_CASE, caseObj);
        expect(http_errors_1.default).toHaveBeenCalledWith(404);
        expect(req.permit).not.toHaveBeenCalled();
        expect(req.block).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
});
describe('canUpdateCaseStatus', () => {
    test('Case not found - throws 404', async () => {
        mockGetCase.mockResolvedValueOnce(undefined);
        await (0, canPerformCaseAction_1.canUpdateCaseStatus)(req, {}, next);
        expect(http_errors_1.default).toHaveBeenCalled();
        expect(req.permit).not.toHaveBeenCalled();
        expect(req.block).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
    const testCases = [true, false].flatMap(successful => [
        {
            existingStatus: 'not closed',
            newStatus: 'closed',
            can: successful,
            permit: successful,
            expectedActionsToCheck: [permissions_1.actionsMaps.case.CLOSE_CASE],
        },
        {
            existingStatus: 'closed',
            newStatus: 'not closed',
            can: successful,
            permit: successful,
            expectedActionsToCheck: [permissions_1.actionsMaps.case.REOPEN_CASE],
        },
        {
            existingStatus: 'not closed',
            newStatus: 'also not closed',
            can: successful,
            permit: successful,
            expectedActionsToCheck: [permissions_1.actionsMaps.case.CASE_STATUS_TRANSITION],
        },
        {
            existingStatus: 'not closed',
            newStatus: 'not closed',
            can: successful,
            permit: true,
            expectedActionsToCheck: [],
        },
        {
            existingStatus: 'closed',
            newStatus: 'closed',
            can: successful,
            permit: true,
            expectedActionsToCheck: [],
        },
    ]);
    (0, jest_each_1.default)(testCases).test('If the existing status $existingStatus is updated to $newStatus, it should check for permissions for actions $expectedActionsToCheck, and when it returns $can, permit if true,m reject otherwise', async ({ newStatus, existingStatus, expectedActionsToCheck, can, permit, }) => {
        req.body = { status: newStatus };
        const caseObj = { status: existingStatus };
        mockGetCase.mockResolvedValueOnce(caseObj);
        req.can.mockReturnValueOnce(can);
        await (0, canPerformCaseAction_1.canUpdateCaseStatus)(req, {}, next);
        expectedActionsToCheck.forEach(action => {
            expect(req.can).toHaveBeenCalledWith(req.user, action, caseObj);
        });
        if (permit) {
            expect(req.permit).toHaveBeenCalled();
            expect(req.block).not.toHaveBeenCalled();
        }
        else {
            expect(req.permit).not.toHaveBeenCalled();
            expect(req.block).toHaveBeenCalled();
        }
        expect(next).toHaveBeenCalled();
        expect(http_errors_1.default).not.toHaveBeenCalled();
    });
});
