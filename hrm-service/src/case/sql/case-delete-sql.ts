export const DELETE_BY_ID = `DELETE FROM "Cases" WHERE "Cases"."accountSid" = $1 AND "Cases"."id" = $2 RETURNING *`;
