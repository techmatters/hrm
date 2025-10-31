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

export const SELECT_RESOURCES = `
SELECT 
    r.id, 
    r."name", 
    r."accountSid", 
    r."lastUpdated",
    stringAtt."attributes" AS "stringAttributes", 
    refStringAtt."attributes" AS "referenceStringAttributes", 
    booleanAtt."attributes" AS "booleanAttributes", 
    numberAtt."attributes" AS "numberAttributes", 
    datetimeAtt."attributes" AS "dateTimeAttributes" 
FROM 
resources."Resources" AS r 
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg((SELECT attributeRow FROM (SELECT ra."key", ra."value", ra."language", ra."info") AS attributeRow)), '[]') AS attributes
    FROM (
      SELECT rsa."key", rsa."value", rsa."language", rsa."info" 
        FROM resources."ResourceStringAttributes" AS rsa
        WHERE rsa."accountSid" = r."accountSid" AND rsa."resourceId" = r.id
    ) AS ra
) AS stringAtt ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg((SELECT attributeRow FROM (SELECT ra."key", ra."list", ra."value", ra."language", ra."info") AS attributeRow)), '[]') AS attributes
    FROM (
      SELECT rrsa."key", rrsav."value", rrsav."language", rrsav."info", rrsav."list"
        FROM 
        resources."ResourceReferenceStringAttributes" AS rrsa
        INNER JOIN resources."ResourceReferenceStringAttributeValues" AS rrsav  ON 
          rrsav."accountSid" = rrsa."accountSid" 
          AND rrsav."list" = rrsa."list" 
          AND rrsav."id" = rrsa."referenceId"
        WHERE rrsa."accountSid" = r."accountSid" AND rrsa."resourceId" = r.id
    ) AS ra
) AS refStringAtt ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg((SELECT attributeRow FROM (SELECT ra."key", ra."value", ra."info") AS attributeRow)), '[]') AS attributes
    FROM (
      SELECT rba."key", rba."value", rba."info"
        FROM resources."ResourceBooleanAttributes" AS rba
        WHERE rba."accountSid" = r."accountSid" AND rba."resourceId" = r.id
    ) AS ra
) AS booleanAtt ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg((SELECT attributeRow FROM (SELECT ra."key", ra."value", ra."info") AS attributeRow)), '[]') AS attributes
    FROM (
      SELECT rna."key", rna."value", rna."info"
        FROM resources."ResourceNumberAttributes" AS rna
        WHERE rna."accountSid" = r."accountSid" AND rna."resourceId" = r.id
    ) AS ra
) AS numberAtt ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg((SELECT attributeRow FROM (SELECT ra."key", ra."value", ra."info") AS attributeRow)), '[]') AS attributes
    FROM (
        SELECT rdta."key", rdta."value", rdta."info" 
        FROM resources."ResourceDateTimeAttributes" AS rdta
        WHERE rdta."accountSid" = r."accountSid" AND rdta."resourceId" = r.id
    ) AS ra
) AS datetimeAtt ON true`;

export const SELECT_RESOURCE_IN_IDS = `${SELECT_RESOURCES}
WHERE r."accountSid" = $<accountSid> AND r."id" IN ($<resourceIds:csv>) AND r."deletedAt" IS NULL
`;

export const SELECT_DISTINCT_RESOURCE_STRING_ATTRIBUTES_SQL = `
  SELECT DISTINCT "value", "info" FROM "ResourceStringAttributes" 
  WHERE "accountSid" = $<accountSid> AND 
  "key" = $<key> AND 
  ($<language> IS NULL OR "language"=$<language>) AND
  ($<valueLikePattern> IS NULL OR "value" LIKE $<valueLikePattern>)`;

export const SELECT_DISTINCT_RESOURCE_STRING_ATTRIBUTES_FROM_DESCENDANT_KEYS_SQL = `
  SELECT DISTINCT "value", "info" FROM "ResourceStringAttributes" 
  WHERE "accountSid" = $<accountSid> AND 
  ("key" = $<key> OR "key" LIKE $<keyLikePattern>) AND 
  ($<language> IS NULL OR "language"=$<language>) AND
  ($<valueLikePattern> IS NULL OR "value" LIKE $<valueLikePattern>)`;
