const IN_IDS_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" IN $<csamReportIds:csv>`;

export const updateContactIdByCsamReportIdsSql = `
  UPDATE "CSAMReports" 
  SET "contactId" = <contactId>
  ${IN_IDS_WHERE_CLAUSE}
  RETURNING *
`;
