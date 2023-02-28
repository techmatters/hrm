/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

export const SELECT_RESOURCE_IN_IDS = `SELECT r.id, r."name", att."attributes" FROM 
resources."Resources" AS r 
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg((SELECT attributeRow FROM (SELECT ra."key", ra."value", ra."language", ra."info") AS attributeRow)), '[]') AS attributes
    FROM (
        SELECT rsa."key", rsa."value", rsa."language", rsa."info" 
        FROM resources."ResourceStringAttributes" AS rsa
        WHERE rsa."accountSid" = r."accountSid" AND rsa."resourceId" = r.id
      UNION ALL 
        SELECT rrsa."key", rrsav."value", rrsav."language", rrsav."info"
        FROM 
        resources."ResourceReferenceStringAttributes" AS rrsa
        INNER JOIN resources."ResourceReferenceStringAttributeValues" AS rrsav ON rrsav."accountSid" = rrsa."accountSid" AND rrsav."id" = rrsa."referenceId"
        WHERE rrsa."accountSid" = r."accountSid" AND rrsa."resourceId" = r.id
    ) AS ra
) AS att ON true
WHERE r."accountSid" = $<accountSid> AND r."id" IN ($<resourceIds:csv>)
`;

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
