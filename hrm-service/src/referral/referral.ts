import { createReferralRecord, Referral } from './referral-data-access';

export const createReferral = async (accountSid: string, referral: Referral) => {
  return createReferralRecord(accountSid, referral);
};
