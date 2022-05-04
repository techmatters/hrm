const ID_WHERE_CLAUSE = `WHERE "cases"."accountSid" = $<accountSid> AND "cases"."id" = $<caseId>`;

export const selectSingleCaseByIdSql = (tableName: string) => `SELECT
        cases.*,
        caseSections."caseSections",
        contacts."connectedContacts"
        FROM "${tableName}" AS cases

        LEFT JOIN LATERAL ( 
        SELECT COALESCE(jsonb_agg(to_jsonb(c) || to_jsonb(reports)), '[]') AS  "connectedContacts" 
        FROM "Contacts" c 
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "csamReports" 
          FROM "CSAMReports" r 
          WHERE r."contactId" = c.id AND r."accountSid" = c."accountSid"
        ) reports ON true
        WHERE c."caseId" = cases.id AND c."accountSid" = cases."accountSid"
      ) contacts ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs."createdAt"), '[]') AS  "caseSections"
          FROM "CaseSections" cs
          WHERE cs."caseId" = cases.id AND cs."accountSid" = cases."accountSid"
        ) caseSections ON true
      ${ID_WHERE_CLAUSE}`;
