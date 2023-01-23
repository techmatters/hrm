export const SELECT_RESOURCE_BY_ID = `SELECT id, "name" FROM resources."Resources" AS r WHERE r."accountSid" = $<accountSid> AND r."id" = $<resourceId>`;
