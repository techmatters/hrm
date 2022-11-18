const ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" = $<csamReportId>`;
const CONTACT_ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."contactId" = $<contactId>`;

export const selectSingleCsamReportByIdSql = `
  SELECT r.*
  FROM "CSAMReports" r
  ${ID_WHERE_CLAUSE}
`;

export const selectCsamReportsByContactIdSql = `
  SELECT r.*
  FROM "CSAMReports" r
  ${CONTACT_ID_WHERE_CLAUSE}
`;
