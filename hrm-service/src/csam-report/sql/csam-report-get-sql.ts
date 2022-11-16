const ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" = $<csamReportId>`;
const IN_IDS_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" IN $<csamReportIds:csv>`;

export const selectSingleCsamReportByIdSql = `
  SELECT r.*
  FROM "CSAMReports"
  ${ID_WHERE_CLAUSE}
`;

export const selectCsamReportsByIdsSql = `
  SELECT r.*
  FROM "CSAMReports"
  ${IN_IDS_WHERE_CLAUSE}
`;
