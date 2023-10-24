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

import { selectCoalesceConversationMediasByContactId } from '../../conversation-media/sql/conversation-media-get-sql';
import { selectCoalesceCsamReportsByContactId } from '../../csam-report/sql/csam-report-get-sql';
import { selectCoalesceReferralsByContactId } from '../../referral/sql/referral-get-sql';

const selectSearchContactBaseQuery = (whereClause: string) => `
  SELECT 
  (count(*) OVER())::INTEGER AS "totalCount",
  contacts.*, reports."csamReports", joinedReferrals."referrals", media."conversationMedia"
  FROM "Contacts" contacts
  LEFT JOIN LATERAL (
    ${selectCoalesceCsamReportsByContactId('contacts')}
  ) reports ON true
  LEFT JOIN LATERAL (
    ${selectCoalesceReferralsByContactId('contacts')}
  ) joinedReferrals ON true
  LEFT JOIN LATERAL (
    ${selectCoalesceConversationMediasByContactId('contacts')}
  ) media ON true

  ${whereClause}

  ORDER BY contacts."timeOfContact" DESC
    OFFSET $<offset>
    LIMIT $<limit>
`;

export const SELECT_CONTACT_SEARCH = selectSearchContactBaseQuery(`
        WHERE contacts."accountSid" = $<accountSid>
        AND ($<helpline> IS NULL OR contacts."helpline" = $<helpline>)
        AND (
          ($<lastNamePattern> IS NULL AND $<firstNamePattern> IS NULL)
          OR (
            "rawJson"->>'callType' IN ($<dataCallTypes:csv>)
            AND (
              $<lastNamePattern> IS NULL 
              OR "rawJson"->'childInformation'->>'lastName' ILIKE $<lastNamePattern>
              OR "rawJson"->'childInformation'->'name'->>'lastName' ILIKE $<lastNamePattern>
            )
            AND (
              $<firstNamePattern> IS NULL 
              OR "rawJson"->'childInformation'->>'firstName' ILIKE $<firstNamePattern>
              OR "rawJson"->'childInformation'->'name'->>'firstName' ILIKE $<firstNamePattern>
            )
          )
          OR (
            "rawJson"->>'callType' = 'Someone calling about a child'
            AND (
              $<lastNamePattern> IS NULL 
              OR "rawJson"->'callerInformation'->>'lastName' ILIKE $<lastNamePattern> 
              OR "rawJson"->'callerInformation'->'name'->>'lastName' ILIKE $<lastNamePattern>
            )
            AND (
              $<firstNamePattern> IS NULL
              OR "rawJson"->'callerInformation'->>'firstName' ILIKE $<firstNamePattern>
              OR "rawJson"->'callerInformation'->'name'->>'firstName' ILIKE $<firstNamePattern>
            )
          )
        )
        AND (
          $<counselor> IS NULL OR contacts."twilioWorkerId" = $<counselor>
        )
        AND (
          $<phoneNumberPattern> IS NULL
          OR "number" ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{childInformation,phone1}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{childInformation,phone2}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{callerInformation,phone1}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{callerInformation,phone2}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
        )
        AND (
          $<dateFrom> IS NULL
          OR contacts."timeOfContact" >= $<dateFrom>
          OR (
            $<shouldIncludeUpdatedAt> = true AND contacts."updatedAt" >= $<dateFrom>
          )
        )
        AND (
          $<dateTo> IS NULL
          OR contacts."timeOfContact" <= $<dateTo>
          OR (
            $<shouldIncludeUpdatedAt> = true AND contacts."updatedAt" <= $<dateTo>
          )
        )
        AND (
          $<contactNumber> IS NULL OR contacts."number" = $<contactNumber> 
        )
        AND (
          $<onlyDataContacts> != true OR (
            "rawJson"->>'callType' IN ($<dataCallTypes:csv>)
          )
        )
`);

export const SELECT_CONTACT_SEARCH_BY_PROFILE_ID = selectSearchContactBaseQuery(`
  WHERE contacts."accountSid" = $<accountSid>
    AND contacts."profileId" = $<profileId>
    AND ($<helpline> IS NULL OR contacts."helpline" = $<helpline>)
    AND ($<counselor> IS NULL OR contacts."twilioWorkerId" = $<counselor>)
`);
