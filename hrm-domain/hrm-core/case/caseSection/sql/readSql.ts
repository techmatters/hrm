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
  ContactListCondition,
  listContactsPermissionWhereClause,
} from '../../../contact/sql/contactPermissionSql';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { TKConditionsSets } from '../../../permissions/rulesMap';
import type { TResult } from '@tech-matters/types';
import { newErr, newOk } from '@tech-matters/types';

export const SELECT_CASE_SECTION_BY_ID = `
  SELECT
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

export const SELECT_CASE_SECTIONS_FOR_TIMELINE = `
  SELECT
        "eventTimestamp" AS "timestamp",
        'case-section' as "activityType",
        to_jsonb("caseSections") AS  "activity"
  FROM "CaseSections" AS "caseSections"
  WHERE "accountSid" = $<accountSid>
    AND "caseId" = $<caseId>
    AND "sectionType" IN ($<sectionTypes:csv>)
    `;

export const selectCaseContactsForTimeline = (
  viewContactPermissions: TKConditionsSets<'contact'>,
  userIsSupervisor: boolean,
) => `
        SELECT 
        "timeOfContact" AS "timestamp",
        'contact' as "activityType",
        to_jsonb("contacts") AS  "activity"
        FROM "Contacts" "contacts"
        WHERE "contacts"."caseId" = $<caseId> AND "contacts"."accountSid" = $<accountSid>
        AND ${listContactsPermissionWhereClause(
          viewContactPermissions as ContactListCondition[][],
          userIsSupervisor,
        )}
`;

export const selectCaseTimelineSql = (
  user: TwilioUser,
  viewContactPermissions: TKConditionsSets<'contact'>,
  includeSections: boolean,
  includeContacts: boolean,
): TResult<'InvalidSettings', string> => {
  if (!includeSections && !includeContacts) {
    return newErr({
      message: 'Must include either sections or contacts to run query',
      error: 'InvalidSettings',
    });
  }

  const PAGINATION_SQL = `ORDER BY "timestamp" DESC LIMIT $<limit> OFFSET $<offset>`;

  if (!includeContacts) {
    return newOk({
      data: `SELECT 
    "sectionEvents".*, 
    (count(*) OVER())::INTEGER AS "totalCount" 
    FROM (${SELECT_CASE_SECTIONS_FOR_TIMELINE}) AS "sectionEvents"
      ${PAGINATION_SQL}`,
    });
  }
  if (!includeSections) {
    return newOk({
      data: `SELECT 
    "contactEvents".*, 
    (count(*) OVER())::INTEGER AS "totalCount"
     FROM (${selectCaseContactsForTimeline(
       viewContactPermissions,
       user.isSupervisor,
     )}) AS "contactEvents"
      ${PAGINATION_SQL}`,
    });
  }
  return newOk({
    data: `SELECT 
     "contactAndSectionEvents".*, 
    (count(*) OVER())::INTEGER AS "totalCount" FROM ((
    ${SELECT_CASE_SECTIONS_FOR_TIMELINE}
    ) UNION ALL (
    ${selectCaseContactsForTimeline(viewContactPermissions, user.isSupervisor)}
    )) AS "contactAndSectionEvents"
    ${PAGINATION_SQL}`,
  });
};
