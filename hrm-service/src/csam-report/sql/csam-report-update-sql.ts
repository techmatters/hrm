const IN_IDS_WHERE_CLAUSE = `WHERE "accountSid" = $<accountSid> AND "id" IN ($<csamReportIds:csv>)`;

export const updateContactIdByCsamReportIdsSql = `
  UPDATE "CSAMReports"
  SET "contactId" = $<contactId>
  ${IN_IDS_WHERE_CLAUSE}
  RETURNING *
`;
