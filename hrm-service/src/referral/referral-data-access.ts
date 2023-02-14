import { db } from '../connection-pool';
import { insertReferralSql } from './sql/referral-insert-sql';
import {
  DatabaseForeignKeyViolationError,
  DatabaseUniqueConstraintViolationError,
  inferDatabaseError,
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
  resourceName: string;
};

export const createReferralRecord = async (
  accountSid: string,
  referral: Referral,
): Promise<Referral> => {
  try {
    return await db.task(conn => conn.one(insertReferralSql({ ...referral, accountSid })));
  } catch (err) {
    const dbErr = inferDatabaseError(err);
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
