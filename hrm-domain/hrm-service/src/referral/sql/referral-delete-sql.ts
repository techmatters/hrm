export const DELETE_CONTACT_REFERRALS_SQL = `
  DELETE FROM "Referrals"
  WHERE "accountSid" = $<accountSid> AND "contactId" = $<contactId>
  RETURNING *
  `;
