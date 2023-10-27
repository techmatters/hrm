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
import { constants } from './constants';
import { constants as contactConstants } from '../../contact/sql/constants';
import { getPaginationSql, PaginationQuery } from '../../sql';

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
        p2i.${constants.foreignIdFieldSql},
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'id', identifiers.id,
                'identifier', identifiers."identifier"
            )
        ) FILTER (WHERE identifiers.id IS NOT NULL) as identifiers
    FROM "ProfilesToIdentifiers" p2i
    JOIN "Identifiers" identifiers ON identifiers.id = p2i."identifierId"
    WHERE p2i.${constants.foreignIdFieldSql} = $<profileId>
    GROUP BY p2i.${constants.foreignIdFieldSql}
  ),

  ContactCaseCounts AS (
    SELECT
        ${contactConstants.tableSql}.${constants.foreignIdFieldSql},
        COUNT(*) as "contactsCount",
        COUNT(DISTINCT ${contactConstants.tableSql}."caseId") as "casesCount"
    FROM ${contactConstants.tableSql}
    WHERE ${contactConstants.tableSql}.${constants.foreignIdFieldSql} = $<profileId>
    GROUP BY ${contactConstants.tableSql}.${constants.foreignIdFieldSql}
  )

  SELECT
    profiles.*,
    COALESCE(ri.identifiers, '[]'::json) as identifiers,
    COALESCE(ccc."contactsCount", 0) as "contactsCount",
    COALESCE(ccc."casesCount", 0) as "casesCount"
  FROM ${constants.tableSql} profiles
  LEFT JOIN RelatedIdentifiers ri ON profiles.id = ri.${constants.foreignIdFieldSql}
  LEFT JOIN ContactCaseCounts ccc ON profiles.id = ccc.${constants.foreignIdFieldSql}
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
    LEFT JOIN ${constants.tableSql} profiles ON profiles.id = p2i.${constants.foreignIdFieldSql} AND profiles."accountSid" = p2i."accountSid"
    LEFT JOIN (
        SELECT ${contactConstants.tableSql}.${constants.foreignIdFieldSql}, COUNT(*) as count
        FROM ${contactConstants.tableSql}
        GROUP BY ${contactConstants.tableSql}.${constants.foreignIdFieldSql}
    ) AS contactsCounts ON profiles.id = contactsCounts.${constants.foreignIdFieldSql}
    LEFT JOIN (
        SELECT ${contactConstants.tableSql}.${constants.foreignIdFieldSql}, COUNT(DISTINCT ${contactConstants.tableSql}."caseId") as count
        FROM ${contactConstants.tableSql}
        WHERE ${contactConstants.tableSql}."caseId" IS NOT NULL
        GROUP BY ${contactConstants.tableSql}.${constants.foreignIdFieldSql}
    ) AS casesCounts ON profiles.id = casesCounts.${constants.foreignIdFieldSql}
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

export const getProfileContactsSql = (paginationQuery: PaginationQuery) => `
  SELECT
    ${contactListPropertiesSql},
    ${contactListRawJsonBuildObjectSql} as "rawJson",
    COUNT(*) OVER() as "totalCount"
  FROM ${contactConstants.tableSql}
  JOIN ${constants.tableSql}
  ON ${contactConstants.tableSql}.${constants.foreignIdFieldSql} = "${
    constants.table
  }"."id"
  WHERE ${constants.tableSql}."accountSid" = $<accountSid> AND "${
    constants.table
  }"."id" = $<profileId>
  ${getPaginationSql(paginationQuery)}
`;
