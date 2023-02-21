// Queries used in other modules for JOINs

const onFkFilteredClause = (contactAlias: string) => `
  referral."contactId" = "${contactAlias}".id AND referral."accountSid" = "${contactAlias}"."accountSid"
`;

export const selectCoalesceReferralsByContactId = (contactAlias: string) => `
  SELECT COALESCE(jsonb_agg(to_jsonb(referral)), '[]') AS  "referrals"
  FROM "Referrals" referral
  WHERE ${onFkFilteredClause(contactAlias)}
`;

export const leftJoinReferralsOnFK = (contactAlias: string) => `
  LEFT JOIN "Referrals" referral ON ${onFkFilteredClause(contactAlias)}
`;
