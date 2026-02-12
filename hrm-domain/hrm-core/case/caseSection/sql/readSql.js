"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectCaseTimelineSql = exports.SELECT_CASE_SECTION_BY_ID = void 0;
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
const contactPermissionSql_1 = require("../../../contact/sql/contactPermissionSql");
const types_1 = require("@tech-matters/types");
exports.SELECT_CASE_SECTION_BY_ID = `
  SELECT
    "sectionType",
    "sectionTypeSpecificData",
    "eventTimestamp",
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy"
  FROM "CaseSections"
  WHERE "accountSid" = $<accountSid>
    AND "caseId" = $<caseId>
    AND "sectionType" = $<sectionType>
    AND "sectionId" = $<sectionId>
    `;
const selectSectionsForTimeline = (filterByType) => `
  SELECT
        "caseId"::text AS "caseId",
        "eventTimestamp" AS "timestamp",
        'case-section' as "activityType",
        to_jsonb("caseSections") AS  "activity"
  FROM "CaseSections" AS "caseSections"
  WHERE "accountSid" = $<accountSid>
    AND "caseId" IN ($<caseIds:csv>)
    ${filterByType ? `AND "sectionType" IN ($<sectionTypes:csv>)` : ''}
    `;
const selectCaseContactsForTimeline = (viewContactPermissions, userIsSupervisor) => `
        SELECT
        "caseId"::text AS "caseId",
        "timeOfContact" AS "timestamp",
        'contact' as "activityType",
        to_jsonb("contacts") AS  "activity"
        FROM "Contacts" "contacts"
        WHERE "contacts"."caseId" IN ($<caseIds:csv>) AND "contacts"."accountSid" = $<accountSid>
        AND ${(0, contactPermissionSql_1.listContactsPermissionWhereClause)(viewContactPermissions, userIsSupervisor)}
`;
const selectCaseTimelineSql = (user, viewContactPermissions, includeSections, includeContacts) => {
    if (includeSections === 'none' && !includeContacts) {
        return (0, types_1.newErr)({
            message: 'Must include either sections or contacts to run query',
            error: 'InvalidSettings',
        });
    }
    const PAGINATION_SQL = `ORDER BY "caseId", "timestamp" DESC LIMIT $<limit> OFFSET $<offset>`;
    if (!includeContacts) {
        return (0, types_1.newOk)({
            data: `SELECT 
    "sectionEvents".*, 
    (count(*) OVER())::INTEGER AS "totalCount" 
    FROM (${selectSectionsForTimeline(includeSections !== 'all')}) AS "sectionEvents"
      ${PAGINATION_SQL}`,
        });
    }
    if (!includeSections) {
        return (0, types_1.newOk)({
            data: `SELECT 
    "contactEvents".*, 
    (count(*) OVER())::INTEGER AS "totalCount"
     FROM (${selectCaseContactsForTimeline(viewContactPermissions, user.isSupervisor)}) AS "contactEvents"
      ${PAGINATION_SQL}`,
        });
    }
    return (0, types_1.newOk)({
        data: `SELECT 
     "contactAndSectionEvents".*, 
    (count(*) OVER())::INTEGER AS "totalCount" FROM ((
    ${selectSectionsForTimeline(includeSections !== 'all')}
    ) UNION ALL (
    ${selectCaseContactsForTimeline(viewContactPermissions, user.isSupervisor)}
    )) AS "contactAndSectionEvents"
    ${PAGINATION_SQL}`,
    });
};
exports.selectCaseTimelineSql = selectCaseTimelineSql;
