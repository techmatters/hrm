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
exports.deleteContactReferrals = exports.createReferralRecord = exports.OrphanedReferralError = exports.DuplicateReferralError = void 0;
const referral_insert_sql_1 = require("./sql/referral-insert-sql");
const sql_1 = require("../sql");
const referral_delete_sql_1 = require("./sql/referral-delete-sql");
const dbConnection_1 = require("../dbConnection");
// Working around the lack of a 'cause' property in the Error class for ES2020 - can be removed when we upgrade to ES2022
class DuplicateReferralError extends Error {
    cause;
    constructor(error) {
        super('A referral with the same resource, contact and referral time already exists.');
        this.cause = error;
        this.name = 'DuplicateReferralError';
        Object.setPrototypeOf(this, DuplicateReferralError.prototype);
    }
}
exports.DuplicateReferralError = DuplicateReferralError;
class OrphanedReferralError extends Error {
    cause;
    contactId;
    constructor(contactId, error) {
        super(`No contact with id '${contactId}' exists to attach this referral to`);
        this.contactId = contactId;
        this.cause = error;
        this.name = 'OrphanedReferralError';
        Object.setPrototypeOf(this, OrphanedReferralError.prototype);
    }
}
exports.OrphanedReferralError = OrphanedReferralError;
const createReferralRecord = (task) => async (accountSid, referral) => {
    try {
        const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
        const statement = (0, referral_insert_sql_1.insertReferralSql)({
            resourceName: undefined,
            ...referral,
            accountSid,
        });
        return await (0, sql_1.txIfNotInOne)(db, task, conn => conn.one(statement));
    }
    catch (err) {
        const dbErr = (0, sql_1.inferPostgresError)(err);
        if (dbErr instanceof sql_1.DatabaseUniqueConstraintViolationError &&
            dbErr.constraint === 'Referrals_pkey') {
            throw new DuplicateReferralError(dbErr);
        }
        if (dbErr instanceof sql_1.DatabaseForeignKeyViolationError &&
            dbErr.constraint === 'FK_Referrals_Contacts') {
            throw new OrphanedReferralError(referral.contactId.toString(), dbErr);
        }
        throw dbErr;
    }
};
exports.createReferralRecord = createReferralRecord;
const deleteContactReferrals = (task) => async (accountSid, contactId) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    return (0, sql_1.txIfNotInOne)(db, task, conn => conn.manyOrNone(referral_delete_sql_1.DELETE_CONTACT_REFERRALS_SQL, { accountSid, contactId }));
};
exports.deleteContactReferrals = deleteContactReferrals;
