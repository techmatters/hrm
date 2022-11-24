const ID_WHERE_CLAUSE = `WHERE "accountSid" = $<accountSid> AND "id" = $<reportId>`;
const IN_IDS_WHERE_CLAUSE = `WHERE "accountSid" = $<accountSid> AND "id" IN ($<reportIds:csv>)`;

export const updateContactIdByCsamReportIdsSql = `
  UPDATE "CSAMReports"
  SET "contactId" = $<contactId>
  ${IN_IDS_WHERE_CLAUSE}
  RETURNING *
`;

export const updateAknowledgedByCsamReportIdSql = `
  UPDATE "CSAMReports"
  SET "aknowledged" = $<aknowledged>
  ${ID_WHERE_CLAUSE}
  RETURNING *
`;
