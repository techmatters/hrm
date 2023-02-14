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

import { db } from '../connection-pool';
import { insertReferralSql } from './sql/referral-insert-sql';
import {
  DatabaseForeignKeyViolationError,
  DatabaseUniqueConstraintViolationError,
  inferPostgresError,
} from '../sql';

// Working atround the lack of
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

export type Referral = {
  contactId: string;
  resourceId: string;
  referredAt: string;
  resourceName?: string;
};

// Represents a referral when part of a contact structure, so no contact ID
export type ReferralWithoutContactId = Omit<Referral, 'contactId'>;

export const createReferralRecord = async (
  accountSid: string,
  referral: Referral,
): Promise<Referral> => {
  try {
    return await db.task(conn =>
      conn.one(insertReferralSql({ resourceName: undefined, ...referral, accountSid })),
    );
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
