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
const date_fns_1 = require("date-fns");
const mockDb_1 = require("../mockDb");
const referralDb = __importStar(require("../../referral/referralDataAccess"));
const referralDataAccess_1 = require("../../referral/referralDataAccess");
const sql_1 = require("../../sql");
// eslint-disable-next-line import/no-extraneous-dependencies
const testing_1 = require("@tech-matters/testing");
let conn;
beforeEach(() => {
    conn = (0, mockDb_1.mockConnection)();
});
describe('createReferralRecord', () => {
    const hourAgo = (0, date_fns_1.subHours)(new Date(), 1);
    const validReferral = {
        contactId: '1234',
        resourceId: 'TEST_RESOURCE',
        referredAt: hourAgo.toISOString(),
        resourceName: 'A test referred resource',
    };
    test('Runs a INSERT against the Referrals table on the DB', async () => {
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(validReferral);
        const result = await referralDb.createReferralRecord()('AC_FAKE', validReferral);
        const insertSql = (0, testing_1.getSqlStatement)(oneSpy);
        expect(insertSql).toContain('Referrals');
        expect(insertSql).toContain(validReferral.resourceId);
        expect(insertSql).toContain(validReferral.referredAt);
        expect(insertSql).toContain(validReferral.contactId);
        expect(insertSql).toContain(validReferral.resourceName);
        expect(insertSql).toContain('AC_FAKE');
        expect(result).toStrictEqual(validReferral);
    });
    test('Inserts explicit NULL for resourceName if not provided', async () => {
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        const { resourceName, ...withoutResourceName } = validReferral;
        const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(withoutResourceName);
        const result = await referralDb.createReferralRecord()('AC_FAKE', withoutResourceName);
        expect(oneSpy).toHaveBeenCalledWith(expect.stringContaining('Referrals'));
        const insertSql = oneSpy.mock.calls[0][0];
        expect(insertSql).toContain(validReferral.resourceId);
        expect(insertSql).toContain(validReferral.referredAt);
        expect(insertSql).toContain(validReferral.contactId);
        expect(insertSql).toContain('null');
        expect(insertSql).toContain('AC_FAKE');
        expect(result).toStrictEqual(withoutResourceName);
    });
    test('Query throws a foreign key violation against contact ID constraint - throws an OrphanedReferralError', async () => {
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        const dbError = new Error();
        dbError.code = '23503';
        dbError.constraint = 'FK_Referrals_Contacts';
        dbError.table = 'Referrals';
        jest.spyOn(conn, 'one').mockRejectedValue(dbError);
        await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(referralDataAccess_1.OrphanedReferralError);
    });
    test('Query throws a foreign key violation against other constraint - throws an DatabaseForeignKeyViolationError', async () => {
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        const dbError = new Error();
        dbError.code = '23503';
        dbError.constraint = 'Other_Constraint';
        dbError.table = 'Referrals';
        jest.spyOn(conn, 'one').mockRejectedValue(dbError);
        await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(sql_1.DatabaseForeignKeyViolationError);
    });
    test('Query throws a unique constraint violation against primary key constraint - throws an DuplicateReferralError', async () => {
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        const dbError = new Error();
        dbError.code = '23505';
        dbError.constraint = 'Referrals_pkey';
        dbError.table = 'Referrals';
        jest.spyOn(conn, 'one').mockRejectedValue(dbError);
        await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(referralDataAccess_1.DuplicateReferralError);
    });
    test('Query throws a unique constraint violation against other constraint - throws an DatabaseUniqueConstraintViolationError', async () => {
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        const dbError = new Error();
        dbError.code = '23505';
        dbError.constraint = 'Other_Constraint';
        dbError.table = 'Referrals';
        jest.spyOn(conn, 'one').mockRejectedValue(dbError);
        await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(sql_1.DatabaseUniqueConstraintViolationError);
    });
    test('Query throws any other error - throws an DatabaseError wrapping the original', async () => {
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        const originalError = new Error();
        originalError.code = 'OTHER_CODE';
        jest.spyOn(conn, 'one').mockRejectedValue(originalError);
        await expect(referralDb.createReferralRecord()('AC_FAKE', validReferral)).rejects.toThrow(new sql_1.DatabaseError(originalError));
    });
    test('Passed a task - uses task', async () => {
        const mockTx = (0, mockDb_1.mockConnection)();
        const mockOuterTask = (0, mockDb_1.mockConnection)();
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC_FAKE');
        (0, mockDb_1.mockTransaction)(mockOuterTask, mockTx, 'AC_FAKE');
        const txOneSpy = jest.spyOn(mockTx, 'one').mockResolvedValue(validReferral);
        const dbOneSpy = jest.spyOn(conn, 'one').mockResolvedValue(validReferral);
        await referralDb.createReferralRecord(mockOuterTask)('AC_FAKE', validReferral);
        expect(dbOneSpy).not.toHaveBeenCalled();
        const insertSql = (0, testing_1.getSqlStatement)(txOneSpy);
        expect(insertSql).toContain('Referrals');
    });
});
