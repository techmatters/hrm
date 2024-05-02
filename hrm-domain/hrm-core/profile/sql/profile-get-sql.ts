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

export const getProfilesSqlBase = (selectTargetProfilesQuery: string) => `
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
  ),
  
  HasRelatedContacts AS (
    SELECT COUNT(*) > 0 as "hasContacts", "profileId" FROM "Contacts" GROUP BY "profileId"
  )

  SELECT
    tp.*,
    COALESCE(ri.identifiers, '[]'::jsonb) as identifiers,
    COALESCE(rpf."profileFlags", '[]'::jsonb) as "profileFlags",
    COALESCE(rps."profileSections", '[]'::jsonb) as "profileSections",
    COALESCE(hrc."hasContacts", false) as "hasContacts"
  FROM TargetProfiles tp
  LEFT JOIN "Profiles" profiles ON profiles.id = tp.id AND profiles."accountSid" = tp."accountSid" -- join on profiles so Postgres will use the indexes
  LEFT JOIN RelatedIdentifiers ri ON profiles.id = ri."profileId"
  LEFT JOIN RelatedProfileFlags rpf ON profiles.id = rpf."profileId"
  LEFT JOIN RelatedProfileSections rps ON profiles.id = rps."profileId"
  -- Remove this hack once we have limited contact view permissions
  LEFT JOIN HasRelatedContacts hrc ON profiles.id = hrc."profileId"
`;

export const getProfileByIdSql = getProfilesSqlBase(`
  SELECT * FROM "Profiles" profiles
  WHERE profiles."accountSid" = $<accountSid> AND profiles."id" = $<profileId>
`);

export const getIdentifierSql = `
  SELECT * FROM "Identifiers" ids
  ${WHERE_IDENTIFIER_CLAUSE}
`;

export const getProfilesByIdentifierSql = `
  SELECT
    profiles.id AS id,
    profiles.name AS name
  FROM "Identifiers" ids
  LEFT JOIN "ProfilesToIdentifiers" p2i ON ids.id = p2i."identifierId"
  LEFT JOIN "Profiles" profiles ON profiles.id = p2i."profileId"
  ${WHERE_IDENTIFIER_CLAUSE}
  GROUP BY profiles.id, profiles.name;
`;
