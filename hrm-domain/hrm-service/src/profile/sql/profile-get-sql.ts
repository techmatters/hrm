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
import {
  contactListPropertiesSql,
  contactListRawJsonBuildObjectSql,
} from '../../contact/sql/contact-get-sql';
import * as constants from './constants';
import * as contactConstants from '../../contact/sql/constants';

const WHERE_IDENTIFIER_CLAUSE = `
  WHERE "accountSid" = $<accountSid> AND
  (
    ("identifier" = $<identifier> AND $<identifier> IS NOT NULL)
    OR
    (ids.id = $<identifierId> AND $<identifierId> IS NOT NULL)
  )
`;

// export const lookupIdentifierSql = `
//   SELECT * FROM "Identifiers"
//   ${WHERE_IDENTIFIER_CLAUSE}
// `;

export const getProfileByIdSql = `
  WITH RelatedIdentifiers AS (
    SELECT
        p2i."${constants.foreignIdField}",
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', identifiers.id,
                'identifier', identifiers."identifier"
            )
        ) FILTER (WHERE identifiers.id IS NOT NULL) as identifiers
    FROM "ProfilesToIdentifiers" p2i
    JOIN "Identifiers" identifiers ON identifiers.id = p2i."identifierId"
    WHERE p2i."${constants.foreignIdField}" = $<profileId>
    GROUP BY p2i."${constants.foreignIdField}"
  ),

  ContactCaseCounts AS (
    SELECT
        "${contactConstants.table}"."${constants.foreignIdField}",
        COUNT(*) as "contactsCount",
        COUNT(DISTINCT "${contactConstants.table}"."caseId") as "casesCount"
    FROM "${contactConstants.table}"
    WHERE "${contactConstants.table}"."${constants.foreignIdField}" = $<profileId>
    GROUP BY "${contactConstants.table}"."${constants.foreignIdField}"
  )

  SELECT
    profiles.*,
    COALESCE(ri.identifiers, '[]'::json) as identifiers,
    COALESCE(ccc."contactsCount", 0) as "contactsCount",
    COALESCE(ccc."casesCount", 0) as "casesCount"
  FROM "${constants.table}" profiles
  LEFT JOIN RelatedIdentifiers ri ON profiles.id = ri."${constants.foreignIdField}"
  LEFT JOIN ContactCaseCounts ccc ON profiles.id = ccc."${constants.foreignIdField}"
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
    LEFT JOIN "${constants.table}" profiles ON profiles.id = p2i."${constants.foreignIdField}" AND profiles."accountSid" = p2i."accountSid"
    LEFT JOIN (
        SELECT "${contactConstants.table}"."${constants.foreignIdField}", COUNT(*) as count
        FROM "${contactConstants.table}"
        GROUP BY "${contactConstants.table}"."${constants.foreignIdField}"
    ) AS contactsCounts ON profiles.id = contactsCounts."${constants.foreignIdField}"
    LEFT JOIN (
        SELECT "${contactConstants.table}"."${constants.foreignIdField}", COUNT(DISTINCT "${contactConstants.table}"."caseId") as count
        FROM "${contactConstants.table}"
        WHERE "${contactConstants.table}"."caseId" IS NOT NULL
        GROUP BY "${contactConstants.table}"."${constants.foreignIdField}"
    ) AS casesCounts ON profiles.id = casesCounts."${constants.foreignIdField}"
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

export const getProfileContactsSql = `
  SELECT
      ${contactListPropertiesSql},
      ${contactListRawJsonBuildObjectSql} as "rawJson"
    FROM "${contactConstants.table}"
    JOIN "${constants.table}"
    ON "${contactConstants.table}"."${constants.foreignIdField}" = "${constants.table}"."id"
    WHERE "${constants.table}"."accountSid" = $<accountSid> AND "${constants.table}"."id" = $<profileId>
`;
