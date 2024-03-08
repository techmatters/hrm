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

export const getProfilesSqlBase = (
  selectTargetProfilesQuery: string,
  returnIds?: boolean,
) => `
  WITH TargetProfiles AS (
    ${selectTargetProfilesQuery}
  ),

  RelatedIdentifiers AS (
    SELECT
        p2i."profileId",
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'id', identifiers.id,
                'identifier', identifiers."identifier"
            )
        ) FILTER (WHERE identifiers.id IS NOT NULL) as identifiers
    FROM TargetProfiles profile
	  LEFT JOIN "ProfilesToIdentifiers" p2i ON p2i."profileId" = profile.id AND p2i."accountSid" = profile."accountSid"
    LEFT JOIN "Identifiers" identifiers ON identifiers.id = p2i."identifierId" AND identifiers."accountSid" = p2i."accountSid"
    GROUP BY p2i."profileId"
  ),
  
  ContactCaseCounts AS (
    SELECT
        "Contacts"."profileId",
        ${
          returnIds
            ? `ARRAY_AGG(DISTINCT "Contacts".id) FILTER (WHERE "Contacts".id IS NOT NULL) as "contactIds",
          ARRAY_AGG(DISTINCT "Contacts"."caseId") FILTER (WHERE "Contacts"."caseId" IS NOT NULL) as "caseIds"`
            : `COUNT(*) as "contactsCount",
          COUNT(DISTINCT "Contacts"."caseId") as "casesCount"`
        }
    FROM TargetProfiles profile
	  LEFT JOIN "Contacts" ON "Contacts"."profileId" = profile.id AND "Contacts"."accountSid" = profile."accountSid"
    GROUP BY "Contacts"."profileId"
  ),

  RelatedProfileFlags AS (
    SELECT
        ppf."profileId",
        JSONB_AGG(JSONB_BUILD_OBJECT('id', ppf."profileFlagId", 'validUntil', ppf."validUntil")) AS "profileFlags"
    FROM TargetProfiles profile
	  LEFT JOIN "ProfilesToProfileFlags" ppf ON ppf."profileId" = profile.id AND ppf."accountSid" = profile."accountSid"
    GROUP BY ppf."profileId"
  ),

  RelatedProfileSections AS (
    SELECT pps."profileId", JSONB_AGG(JSONB_BUILD_OBJECT(
      'id', pps.id,
      'sectionType', pps."sectionType"
    )) AS "profileSections"
    FROM TargetProfiles profile
	  LEFT JOIN "ProfileSections" pps ON pps."profileId" = profile.id AND pps."accountSid" = profile."accountSid"
    GROUP BY pps."profileId"
  )

  SELECT
    tp.*,
    COALESCE(ri.identifiers, '[]'::jsonb) as identifiers,
    COALESCE(ccc."contactsCount"::int, 0) as "contactsCount",
    COALESCE(ccc."casesCount"::int, 0) as "casesCount",
    COALESCE(rpf."profileFlags", '[]'::jsonb) as "profileFlags",
    COALESCE(rps."profileSections", '[]'::jsonb) as "profileSections"
  FROM TargetProfiles tp
  LEFT JOIN "Profiles" profiles ON profiles.id = tp.id AND profiles."accountSid" = tp."accountSid" -- join on profiles so Postgres will use the indexes
  LEFT JOIN RelatedIdentifiers ri ON profiles.id = ri."profileId"
  LEFT JOIN ContactCaseCounts ccc ON profiles.id = ccc."profileId"
  LEFT JOIN RelatedProfileFlags rpf ON profiles.id = rpf."profileId"
  LEFT JOIN RelatedProfileSections rps ON profiles.id = rps."profileId"


`;

export const profilesSearchSql = ({}: {
  accountSid: string;
  startDate: Date;
  endDate: Date;
  offset: number;
  limit: number;
}) =>
  getProfilesSqlBase(
    `
  SELECT * FROM "Profiles" profiles
  WHERE profiles."accountSid" = $<accountSid> AND profile."createdAt" BETWEEN $<startDate> AND $<endDate>
  ORDER BY tp."createdAt" DESC
  OFFSET $<offset>
  LIMIT $<limit>
`,
    true,
  );
