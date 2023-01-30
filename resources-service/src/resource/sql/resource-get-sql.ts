export const SELECT_RESOURCE_BY_ID = `SELECT id, "name" FROM resources."Resources" AS r WHERE r."accountSid" = $<accountSid> AND r."id" = $<resourceId>`;

export const SELECT_RESOURCE_IN_IDS = `SELECT id, "name" FROM resources."Resources" AS r WHERE r."accountSid" = $<accountSid> AND r."id" IN ($<resourceIds:csv>)`;

export const SELECT_RESOURCE_IDS_WHERE_NAME_CONTAINS = `
  SELECT id 
  FROM resources."Resources" AS r 
  WHERE r."accountSid" = $<accountSid> AND r."name" ILIKE $<namePattern>
  ORDER BY r."name"
  LIMIT $<limit>
  OFFSET $<start>;
  SELECT count(*)::INTEGER AS "totalCount" 
  FROM resources."Resources" AS r 
  WHERE r."accountSid" = $<accountSid> AND r."name" ILIKE $<namePattern>
`;
