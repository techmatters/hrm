"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSERT_CONTACT_SQL = void 0;
const contact_get_sql_1 = require("./contact-get-sql");
exports.INSERT_CONTACT_SQL = `
  WITH existing AS (
      ${(0, contact_get_sql_1.selectSingleContactByTaskId)('Contacts')}
  ), inserted AS (
    INSERT INTO "Contacts" (
      "accountSid",
      "rawJson",
      "queueName",
      "twilioWorkerId",
      "createdBy",
      "createdAt",
      "updatedAt",
      "helpline",
      "channel",
      "number",
      "conversationDuration",
      "timeOfContact",
      "taskId",
      "channelSid",
      "serviceSid",
      "profileId",
      "identifierId",
      "definitionVersion"
    ) (SELECT 
        $<accountSid>, 
        $<rawJson>, 
        $<queueName>, 
        $<twilioWorkerId>, 
        $<createdBy>, 
        $<createdAt>, 
        $<updatedAt>, 
        $<helpline>, 
        $<channel>, 
        $<number>, 
        $<conversationDuration>, 
        $<timeOfContact>, 
        $<taskId>, 
        $<channelSid>, 
        $<serviceSid>,
        $<profileId>,
        $<identifierId>,
        $<definitionVersion>
      WHERE NOT EXISTS (
        ${(0, contact_get_sql_1.selectSingleContactByTaskId)('Contacts')}
      )
    )
    RETURNING *
  )
  SELECT "existing".*, false AS "isNewRecord" FROM "existing"
  UNION
  SELECT "inserted".*, NULL AS "csamReports", NULL AS "referrals", NULL AS "conversationMedia", true AS "isNewRecord" FROM "inserted"
`;
