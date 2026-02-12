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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jest_each_1 = __importDefault(require("jest-each"));
const types_1 = require("@tech-matters/types");
const canPerformActionOnObject_1 = require("../../permissions/canPerformActionOnObject");
const permissions_1 = require("../../permissions");
const contactApi = __importStar(require("../../contact/contactService"));
const caseApi = __importStar(require("../../case/caseService"));
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const accountSid = 'ACxxxxxx';
const getContactByIdSpy = jest
    .spyOn(contactApi, 'getContactById')
    .mockImplementation(() => Promise.resolve({ accountSid }));
const getCaseSpy = jest
    .spyOn(caseApi, 'getCase')
    .mockImplementation(() => Promise.resolve({ accountSid }));
afterEach(() => {
    jest.clearAllMocks();
});
describe('canPerformActionsOnObject', () => {
    (0, jest_each_1.default)([
        ...Object.keys(permissions_1.actionsMaps)
            .filter(tk => !['profile', 'profileSection', 'contactField'].includes(tk))
            .flatMap(targetKind => Object.values(permissions_1.actionsMaps[targetKind]).map(action => ({
            targetKind,
            action,
        })))
            .flatMap(testCase => [
            {
                ...testCase,
                shouldCan: true,
                shouldAccessDB: true,
                success: true,
            },
            {
                ...testCase,
                shouldCan: false,
                shouldAccessDB: true,
                success: true,
            },
        ]),
        ...Object.keys(permissions_1.actionsMaps).map(targetKind => ({
            targetKind,
            action: 'invalid',
            shouldCan: false,
            success: false,
        })),
        ...Object.keys(permissions_1.actionsMaps).map(targetKind => ({
            targetKind,
            action: 'view' + targetKind[0].toUpperCase() + targetKind.slice(1),
            mockedCan: () => {
                throw new Error('Boom');
            },
            shouldCan: false,
            success: false,
        })),
        {
            targetKind: 'contactField',
            action: 'editContactField',
            mockedCan: () => {
                throw new Error('Boom');
            },
            shouldCan: false,
            success: false,
        },
    ]).test('when targetKind is $targetKind, action $action and should be allowed evaluates to $shouldCan, should result in $expected', async ({ targetKind, action, shouldCan, success, mockedCan, shouldAccessDB }) => {
        const result = await (0, canPerformActionOnObject_1.canPerformActionsOnObject)({
            hrmAccountId: accountSid,
            targetKind,
            actions: [action],
            objectId: '123',
            can: mockedCan ? mockedCan : () => shouldCan,
            user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, 'WK-workerSid', []),
        });
        if (shouldAccessDB) {
            if (targetKind === 'contact') {
                expect(getContactByIdSpy).toHaveBeenCalled();
            }
            if (targetKind === 'case') {
                expect(getCaseSpy).toHaveBeenCalled();
            }
        }
        if (success) {
            expect((0, types_1.isOk)(result)).toBeTruthy();
            expect((0, types_1.isOk)(result) && result.data).toBe(shouldCan);
        }
        else {
            expect((0, types_1.isErr)(result)).toBeTruthy();
        }
    });
});
