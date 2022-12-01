const ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" = $<reportId>`;
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

// Queries used in other modules for JOINs

const onFkFilteredClause = (contactAlias: string) => `
  r."contactId" = "${contactAlias}".id AND r."accountSid" = "${contactAlias}"."accountSid" AND r."acknowledged" = TRUE
`;

export const selectCoalesceCsamReportsByContactId = (contactAlias: string) => `
  SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "csamReports"
  FROM "CSAMReports" r
  WHERE ${onFkFilteredClause(contactAlias)}
`;

export const leftJoinCsamReportsOnFK = (contactAlias: string) => `
  LEFT JOIN "CSAMReports" r ON ${onFkFilteredClause(contactAlias)}
`;
