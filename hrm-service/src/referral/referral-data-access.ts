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

// eslint-disable-next-line prettier/prettier
import type { ITask } from 'pg-promise';
import { db } from '../connection-pool';
import { insertReferralSql } from './sql/referral-insert-sql';
import {
  DatabaseForeignKeyViolationError,
  DatabaseUniqueConstraintViolationError,
  inferPostgresError,
} from '../sql';

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

export type Referral = {
  contactId: string;
  resourceId: string;
  referredAt: string;
  resourceName?: string;
};

export const createReferralRecord = async (
  accountSid: string,
  referral: Referral,
  tx?: ITask<{}>,
): Promise<Referral> => {
  try {
    const statement = insertReferralSql({ resourceName: undefined, ...referral, accountSid });

    // If a transaction is provided, use it
    if (tx) {
      return await tx.one(statement);
    }

    return await db.task(conn =>
      conn.one(statement),
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
