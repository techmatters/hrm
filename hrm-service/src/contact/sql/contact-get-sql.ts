const ID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."id" = $<contactId>`;
const TASKID_WHERE_CLAUSE = `WHERE c."accountSid" = $<accountSid> AND c."taskId" = $<taskId>`;

export const selectContactsWithCsamReports = (table: string) => `
        SELECT c.*, reports."csamReports" 
        FROM "${table}" c 
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "csamReports" 
          FROM "CSAMReports" r 
          WHERE r."contactId" = c.id AND r."accountSid" = c."accountSid"
        ) reports ON true`;

export const selectSingleContactByIdSql = (table: string) => `
      ${selectContactsWithCsamReports(table)}
      ${ID_WHERE_CLAUSE}`;

export const selectSingleContactByTaskId = (table: string) => ` 
      ${selectContactsWithCsamReports(table)}
      ${TASKID_WHERE_CLAUSE}
      -- only take the latest, this ORDER / LIMIT clause would be redundant 
      ORDER BY c."createdAt" DESC LIMIT 1`;
