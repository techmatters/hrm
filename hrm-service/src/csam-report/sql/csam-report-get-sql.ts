const ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" = $<csamReportId>`;
const CONTACT_ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."contactId" = $<contactId>`;

export const selectSingleCsamReportByIdSql = `
  SELECT r.*
  FROM "CSAMReports"
  ${ID_WHERE_CLAUSE}
`;

export const selectCsamReportsByContactIdSql = `
  SELECT r.*
  FROM "CSAMReports"
  ${CONTACT_ID_WHERE_CLAUSE}
`;
