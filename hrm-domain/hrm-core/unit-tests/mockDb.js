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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockTransaction = exports.mockTask = exports.getMockAccountDb = exports.mockConnection = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const pgMocking = __importStar(require("@tech-matters/testing"));
const dbConnection_1 = require("../dbConnection");
const userDbs = {};
let adminDb = pgMocking.createMockConnection();
jest.mock('../dbConnection', () => ({
    getDbForAdmin: () => adminDb,
    getDbForAccount: (accountSid) => {
        // Might already have been populated by a call to mockTask
        userDbs[accountSid] =
            userDbs[accountSid] ?? pgMocking.createMockConnection();
        return Promise.resolve(userDbs[accountSid]);
    },
    pgp: jest.requireActual('../dbConnection').pgp,
}));
exports.mockConnection = pgMocking.createMockConnection;
const getMockAccountDb = (userKey) => {
    if (!userDbs[userKey]) {
        userDbs[userKey] = pgMocking.createMockConnection();
    }
    return userDbs[userKey];
};
exports.getMockAccountDb = getMockAccountDb;
const mockTask = (mockConn, userKey) => {
    let userDb;
    if (userKey) {
        userDb = (0, exports.getMockAccountDb)(userKey);
    }
    else {
        // Assume legacy code
        userDb = (0, dbConnection_1.getDbForAdmin)();
    }
    pgMocking.mockTask(userDb, mockConn);
};
exports.mockTask = mockTask;
const mockTransaction = (mockConn, mockTx = undefined, userKey) => {
    let userDb;
    if (userKey) {
        userDb = (0, exports.getMockAccountDb)(userKey);
    }
    else {
        // Assume legacy code
        userDb = adminDb;
    }
    return pgMocking.mockTransaction(userDb, mockConn, mockTx);
};
exports.mockTransaction = mockTransaction;
