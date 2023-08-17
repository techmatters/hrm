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

import { selectSingleContactByIdSql } from './contact-get-sql';

const ID_WHERE_CLAUSE = `WHERE "accountSid" = $<accountSid> AND "id"=$<contactId>`;

export const UPDATE_RAWJSON_BY_ID = `WITH updated AS (
UPDATE "Contacts" 
SET "rawJson" = COALESCE("rawJson", '{}'::JSONB) 
-- Case Information and / or category patch
  || (
  -- non category case information supplied
      CASE WHEN $<caseInformation> IS NOT NULL 
      THEN (
        jsonb_build_object(
          'caseInformation', 
          $<caseInformation>::JSONB || 
          CASE WHEN $<categories> IS NOT NULL 
          THEN 
            -- New categories are supplied along with new case information, so overwrite those too
            jsonb_build_object('categories', $<categories>::JSONB) 
          ELSE 
            -- Ensure the existing categories are retained if no new ones are supplied
            CASE WHEN "rawJson"->'caseInformation'->'categories' IS NOT NULL THEN jsonb_build_object('categories', "rawJson"->'caseInformation'->'categories') ELSE '{}'::JSONB END
          END
        )
      ) 
      ELSE 
        CASE WHEN $<categories> IS NOT NULL 
        -- New categories are supplied but not other case information, so overwrite the categories property whilst leaving all the other case information properties as is.
        THEN jsonb_build_object('caseInformation', COALESCE("rawJson"->'caseInformation', '{}'::JSONB) || jsonb_build_object('categories', $<categories>::JSONB))
        ELSE '{}'::JSONB END 
      END
  )
  || (CASE WHEN $<callerInformation> IS NOT NULL THEN jsonb_build_object('callerInformation', $<callerInformation>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<childInformation> IS NOT NULL THEN jsonb_build_object('childInformation', $<childInformation>::JSONB) ELSE '{}'::JSONB END),
  "updatedBy" = $<updatedBy>,
  "updatedAt" = CURRENT_TIMESTAMP
${ID_WHERE_CLAUSE}
RETURNING *
)
${selectSingleContactByIdSql('updated')}
`;

export const UPDATE_CASEID_BY_ID = `WITH updated AS (
UPDATE "Contacts" 
SET 
  "caseId" = $<caseId>
${ID_WHERE_CLAUSE}
RETURNING *
)
${selectSingleContactByIdSql('updated')}
`;
