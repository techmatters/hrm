const ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" = $<reportId>`;

export const deleteSingleCsamReportByIdSql = `
  DELETE
  FROM "CSAMReports" r
  ${ID_WHERE_CLAUSE}
`;
