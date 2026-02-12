"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfilesByIdentifierSql = exports.getIdentifierSql = exports.getProfileByIdSql = exports.getProfilesSqlBase = void 0;
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
const getProfilesSqlBase = (selectTargetProfilesQuery, includeFullRelations) => `
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
        ppfpf."profileId",
        ${includeFullRelations
    ? `JSONB_AGG(TO_JSONB(ppfpf))`
    : `JSONB_AGG(JSONB_BUILD_OBJECT('id', ppfpf."profileFlagId", 'validUntil', ppfpf."validUntil"))`} AS "profileFlags"
    FROM TargetProfiles profile
	  LEFT JOIN LATERAL (
        SELECT ppf."validUntil", ppf."profileId", ppf."profileFlagId", pf.* FROM "ProfilesToProfileFlags" ppf LEFT JOIN "ProfileFlags" pf ON ppf."profileFlagId" = pf."id" WHERE ppf."profileId" = profile.id AND ppf."accountSid" = profile."accountSid"
      ) ppfpf ON 1=1
    GROUP BY ppfpf."profileId"
  ),

  RelatedProfileSections AS (
        
    SELECT pps."profileId",
     ${includeFullRelations
    ? `JSONB_AGG(TO_JSONB(pps))`
    : `JSONB_AGG(JSONB_BUILD_OBJECT(
      'id', pps.id,
      'sectionType', pps."sectionType"
      ))`}
          AS "profileSections"
    FROM TargetProfiles profile
	  LEFT JOIN "ProfileSections" pps ON pps."profileId" = profile.id AND pps."accountSid" = profile."accountSid"
    GROUP BY pps."profileId"
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
  LEFT JOIN LATERAL (SELECT COUNT(*) > 0 as "hasContacts", "profileId", "accountSid" FROM "Contacts" c WHERE profiles.id = c."profileId" AND profiles."accountSid" = c."accountSid" GROUP BY "profileId", "accountSid") hrc ON true
`;
exports.getProfilesSqlBase = getProfilesSqlBase;
const getProfileByIdSql = (includeSectionContent) => (0, exports.getProfilesSqlBase)(`
  SELECT * FROM "Profiles" profiles
  WHERE profiles."accountSid" = $<accountSid> AND profiles."id" = $<profileId>
`, includeSectionContent);
exports.getProfileByIdSql = getProfileByIdSql;
exports.getIdentifierSql = `
  SELECT * FROM "Identifiers" ids
  ${WHERE_IDENTIFIER_CLAUSE}
`;
exports.getProfilesByIdentifierSql = `
  SELECT
    profiles.id AS id,
    profiles.name AS name
  FROM "Identifiers" ids
  LEFT JOIN "ProfilesToIdentifiers" p2i ON ids.id = p2i."identifierId"
  LEFT JOIN "Profiles" profiles ON profiles.id = p2i."profileId"
  ${WHERE_IDENTIFIER_CLAUSE}
  GROUP BY profiles.id, profiles.name;
`;
