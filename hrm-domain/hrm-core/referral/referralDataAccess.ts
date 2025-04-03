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

import { Referral } from '@tech-matters/hrm-types';

import { insertReferralSql } from './sql/referral-insert-sql';
import {
  DatabaseForeignKeyViolationError,
  DatabaseUniqueConstraintViolationError,
  inferPostgresError,
  txIfNotInOne,
} from '../sql';
import { DELETE_CONTACT_REFERRALS_SQL } from './sql/referral-delete-sql';
import { getDbForAccount } from '../dbConnection';

// Working around the lack of a 'cause' property in the Error class for ES2020 - can be removed when we upgrade to ES2022
export class DuplicateReferralError extends Error {
  cause: Error;

  constructor(error: Error) {
    super('A referral with the same resource, contact and referral time already exists.');
    this.cause = error;
    this.name = 'DuplicateReferralError';
    Object.setPrototypeOf(this, DuplicateReferralError.prototype);
  }
}

export class OrphanedReferralError extends Error {
  cause: Error;

  contactId: string;

  constructor(contactId: string, error: Error) {
    super(`No contact with id '${contactId}' exists to attach this referral to`);
    this.contactId = contactId;
    this.cause = error;
    this.name = 'OrphanedReferralError';
    Object.setPrototypeOf(this, OrphanedReferralError.prototype);
  }
}

export { Referral };

export const createReferralRecord =
  (task?) =>
  async (accountSid: string, referral: Referral): Promise<Referral> => {
    try {
      const db = await getDbForAccount(accountSid);

      const statement = insertReferralSql({
        resourceName: undefined,
        ...referral,
        accountSid,
      });

      return await txIfNotInOne(db, task, conn => conn.one(statement));
    } catch (err) {
      const dbErr = inferPostgresError(err);
      if (
        dbErr instanceof DatabaseUniqueConstraintViolationError &&
        dbErr.constraint === 'Referrals_pkey'
      ) {
        throw new DuplicateReferralError(dbErr);
      }
      if (
        dbErr instanceof DatabaseForeignKeyViolationError &&
        dbErr.constraint === 'FK_Referrals_Contacts'
      ) {
        throw new OrphanedReferralError(referral.contactId, dbErr);
      }
      throw dbErr;
    }
  };

export const deleteContactReferrals =
  (task?) =>
  async (accountSid: string, contactId: string): Promise<Referral[]> => {
    const db = await getDbForAccount(accountSid);
    return txIfNotInOne(db, task, conn =>
      conn.manyOrNone(DELETE_CONTACT_REFERRALS_SQL, { accountSid, contactId }),
    );
  };
