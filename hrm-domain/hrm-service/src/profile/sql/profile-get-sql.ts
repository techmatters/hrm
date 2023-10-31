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
  WHERE "accountSid" = $<accountSid> AND
  (
    ("identifier" = $<identifier> AND $<identifier> IS NOT NULL)
    OR
    (ids.id = $<identifierId> AND $<identifierId> IS NOT NULL)
  )
`;

export const getProfileByIdSql = `
  WITH RelatedIdentifiers AS (
    SELECT
        p2i."profileId",
        JSON_AGG(
            JSON_BUILD_OBJECT(
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
        JSON_AGG(ppf."profileFlagId") AS "profileFlags"
    FROM "ProfilesToProfileFlags" ppf
    WHERE ppf."profileId" = $<profileId>
    GROUP BY ppf."profileId"
  )

  RelatedProfileSections AS (
    SELECT pps."profileId", JSON_AGG(pps.*) AS "profileSections"
    FROM "ProfileSections" pps
    WHERE pps."profileId" = $<profileId> AND pps."accountSid" = $<accountSid>
    GROUP BY pps."profileId"
  )

  SELECT
    profiles.*,
    COALESCE(ri.identifiers, '[]'::json) as identifiers,
    COALESCE(ccc."contactsCount"::int, 0) as "contactsCount",
    COALESCE(ccc."casesCount"::int, 0) as "casesCount",
    COALESCE(rpf."profileFlags", '[]'::json) as "profileFlags",
    COALESCE(rps."profileSections", '[]'::json) as "profileSections"
  FROM "Profiles" profiles
  LEFT JOIN RelatedIdentifiers ri ON profiles.id = ri."profileId"
  LEFT JOIN ContactCaseCounts ccc ON profiles.id = ccc."profileId"
  LEFT JOIN RelatedProfileFlags rpf ON profiles.id = rpf."profileId"
  LEFT JOIN RelatedProfileSections rps ON profiles.id = rps."profileId"
  WHERE profiles."accountSid" = $<accountSid> AND profiles."id" = $<profileId>
`;

export const joinProfilesIdentifiersSql = `
  WITH ProfileAggregation AS (
    SELECT
        p2i."identifierId",
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', profiles.id,
                'name', profiles.name,
                'contactsCount', COALESCE(contactsCounts.count, 0),
                'casesCount', COALESCE(casesCounts.count, 0)
            )
        ) FILTER (WHERE profiles.id IS NOT NULL) as profiles_data
    FROM "ProfilesToIdentifiers" p2i
    LEFT JOIN "Profiles" profiles ON profiles.id = p2i."profileId" AND profiles."accountSid" = p2i."accountSid"
    LEFT JOIN (
        SELECT "Contacts"."profileId", COUNT(*) as count
        FROM "Contacts"
        GROUP BY "Contacts"."profileId"
    ) AS contactsCounts ON profiles.id = contactsCounts."profileId"
    LEFT JOIN (
        SELECT "Contacts"."profileId", COUNT(DISTINCT "Contacts"."caseId") as count
        FROM "Contacts"
        WHERE "Contacts"."caseId" IS NOT NULL
        GROUP BY "Contacts"."profileId"
    ) AS casesCounts ON profiles.id = casesCounts."profileId"
    GROUP BY p2i."identifierId"
  )

  SELECT
    ROW_TO_JSON(t.*) AS data
  FROM (
    SELECT
        ids.*,
        COALESCE(pa.profiles_data, '[]'::json) as profiles
    FROM "Identifiers" as "ids"
    LEFT JOIN ProfileAggregation pa ON ids.id = pa."identifierId"
    ${WHERE_IDENTIFIER_CLAUSE}
    LIMIT 1
  ) t;
`;
