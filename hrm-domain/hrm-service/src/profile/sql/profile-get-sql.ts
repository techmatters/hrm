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
const WHERE_IDENTIFIER_CLAUSE = `
  WHERE ids."accountSid" = $<accountSid> AND
  (
    (ids."identifier" = $<identifier> AND $<identifier> IS NOT NULL)
    OR
    (ids.id = $<identifierId> AND $<identifierId> IS NOT NULL)
  )
`;

export const getProfileByIdSql = `
  WITH RelatedIdentifiers AS (
    SELECT
        p2i."profileId",
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'id', identifiers.id,
                'identifier', identifiers."identifier"
            )
        ) FILTER (WHERE identifiers.id IS NOT NULL) as identifiers
    FROM "ProfilesToIdentifiers" p2i
    JOIN "Identifiers" identifiers ON identifiers.id = p2i."identifierId"
    WHERE p2i."profileId" = $<profileId>
    GROUP BY p2i."profileId"
  ),

  ContactCaseCounts AS (
    SELECT
        "Contacts"."profileId",
        COUNT(*) as "contactsCount",
        COUNT(DISTINCT "Contacts"."caseId") as "casesCount"
    FROM "Contacts"
    WHERE "Contacts"."profileId" = $<profileId>
    GROUP BY "Contacts"."profileId"
  ),

  RelatedProfileFlags AS (
    SELECT
        ppf."profileId",
        JSONB_AGG(JSONB_BUILD_OBJECT('id', ppf."profileFlagId", 'validUntil', ppf."validUntil")) AS "profileFlags"
    FROM "ProfilesToProfileFlags" ppf
    WHERE ppf."profileId" = $<profileId>
    GROUP BY ppf."profileId"
  ),

  RelatedProfileSections AS (
    SELECT pps."profileId", JSONB_AGG(JSONB_BUILD_OBJECT(
      'id', pps.id,
      'sectionType', pps."sectionType"
    )) AS "profileSections"
    FROM "ProfileSections" pps
    WHERE pps."profileId" = $<profileId> AND pps."accountSid" = $<accountSid>
    GROUP BY pps."profileId"
  )

  SELECT
    profiles.*,
    COALESCE(ri.identifiers, '[]'::jsonb) as identifiers,
    COALESCE(ccc."contactsCount"::int, 0) as "contactsCount",
    COALESCE(ccc."casesCount"::int, 0) as "casesCount",
    COALESCE(rpf."profileFlags", '[]'::jsonb) as "profileFlags",
    COALESCE(rps."profileSections", '[]'::jsonb) as "profileSections"
  FROM "Profiles" profiles
  LEFT JOIN RelatedIdentifiers ri ON profiles.id = ri."profileId"
  LEFT JOIN ContactCaseCounts ccc ON profiles.id = ccc."profileId"
  LEFT JOIN RelatedProfileFlags rpf ON profiles.id = rpf."profileId"
  LEFT JOIN RelatedProfileSections rps ON profiles.id = rps."profileId"
  WHERE profiles."accountSid" = $<accountSid> AND profiles."id" = $<profileId>
`;

export const getIdentifierSql = `
  SELECT * FROM "Identifiers" ids
  ${WHERE_IDENTIFIER_CLAUSE}
`;

export const getProfilesByIdentifierSql = `
  SELECT
    profiles.id AS id,
    profiles.name AS name,
    CAST(COUNT(DISTINCT CASE WHEN "Contacts"."caseId" IS NOT NULL THEN "Contacts"."profileId" END) AS INTEGER) AS "casesCount",
    CAST(COUNT(CASE WHEN "Contacts"."profileId" IS NOT NULL THEN 1 END) AS INTEGER) AS "contactsCount"
  FROM "Identifiers" ids
  LEFT JOIN "ProfilesToIdentifiers" p2i ON ids.id = p2i."identifierId"
  LEFT JOIN "Profiles" profiles ON profiles.id = p2i."profileId"
  LEFT JOIN "Contacts" ON "Contacts"."profileId" = profiles.id
  ${WHERE_IDENTIFIER_CLAUSE}
  GROUP BY profiles.id, profiles.name;
`;
