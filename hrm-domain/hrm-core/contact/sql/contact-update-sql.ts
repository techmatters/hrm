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

export const UPDATE_CONTACT_BY_ID = `WITH updated AS (
UPDATE "Contacts"
SET "rawJson" = COALESCE("rawJson", '{}'::JSONB)
  || (CASE WHEN $<caseInformation> IS NOT NULL THEN jsonb_build_object('caseInformation', $<caseInformation>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<categories> IS NOT NULL THEN jsonb_build_object('categories', $<categories>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<callerInformation> IS NOT NULL THEN jsonb_build_object('callerInformation', $<callerInformation>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<childInformation> IS NOT NULL THEN jsonb_build_object('childInformation', $<childInformation>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<contactlessTask> IS NOT NULL THEN jsonb_build_object('contactlessTask', $<contactlessTask>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<callType> IS NOT NULL THEN jsonb_build_object('callType', $<callType>) ELSE '{}'::JSONB END)
  || (CASE WHEN $<definitionVersion> IS NOT NULL THEN jsonb_build_object('definitionVersion', $<definitionVersion>) ELSE '{}'::JSONB END)
  || (CASE WHEN $<llmSupportedEntries> IS NOT NULL THEN jsonb_build_object('llmSupportedEntries', $<llmSupportedEntries>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<hangUpBy> IS NOT NULL THEN jsonb_build_object('hangUpBy', $<hangUpBy>) ELSE '{}'::JSONB END),
  "updatedBy" = $<updatedBy>,
  "queueName" =   COALESCE($<queueName>, "queueName"),
  "twilioWorkerId" =   COALESCE($<twilioWorkerId>, "twilioWorkerId"),
  "helpline" =   COALESCE($<helpline>, "helpline"),
  "channel" =   COALESCE($<channel>, "channel"),
  "number" =   COALESCE($<number>, "number"),
  "conversationDuration" =   COALESCE($<conversationDuration>, "conversationDuration"),
  "timeOfContact" =   COALESCE($<timeOfContact>, "timeOfContact"),
  "taskId" =   COALESCE($<taskId>, "taskId"),
  "channelSid" =   COALESCE($<channelSid>, "channelSid"),
  "serviceSid" =   COALESCE($<serviceSid>, "serviceSid"),
  "profileId" =   COALESCE($<profileId>, "profileId"),
  "identifierId" =   COALESCE($<identifierId>, "identifierId"),
  "updatedAt" = CURRENT_TIMESTAMP,
  "caseId" =   COALESCE($<caseId>, "caseId"),
  "finalizedAt" = COALESCE("finalizedAt", (CASE WHEN $<finalize> = true THEN CURRENT_TIMESTAMP ELSE NULL END))
${ID_WHERE_CLAUSE}
RETURNING *
)
${selectSingleContactByIdSql('updated')}
`;

export const UPDATE_CASEID_BY_ID = `WITH updated AS (
UPDATE "Contacts"
SET
  "caseId" = $<caseId>,
  "updatedAt" = CURRENT_TIMESTAMP,  
  "updatedBy" = $<updatedBy>
${ID_WHERE_CLAUSE}
RETURNING *
)
${selectSingleContactByIdSql('updated')}
`;
