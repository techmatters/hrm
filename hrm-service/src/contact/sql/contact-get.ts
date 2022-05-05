const ID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."id" = $<contactId>`;

export const selectSingleContactByIdSql = (table: string) => `
        SELECT c.*, reports."csamReports" 
        FROM "${table}" c 
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "csamReports" 
          FROM "CSAMReports" r 
          WHERE r."contactId" = c.id AND r."accountSid" = c."accountSid"
        ) reports ON true
      ${ID_WHERE_CLAUSE}`;
