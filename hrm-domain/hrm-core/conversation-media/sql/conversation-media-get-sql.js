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
 * along with this progracm.  If not, see https://www.gnu.org/licenses/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectCoalesceConversationMediasByContactId = exports.selectConversationMediaByContactIdSql = exports.selectSingleConversationMediaByIdSql = exports.ID_WHERE_CLAUSE = void 0;
exports.ID_WHERE_CLAUSE = `WHERE cm."accountSid" = $<accountSid> AND cm."id" = $<id>`;
const CONTACT_ID_WHERE_CLAUSE = `WHERE cm."accountSid" = $<accountSid> AND cm."contactId" = $<contactId>`;
exports.selectSingleConversationMediaByIdSql = `
  SELECT cm.*
  FROM "ConversationMedias" cm
  ${exports.ID_WHERE_CLAUSE}
`;
exports.selectConversationMediaByContactIdSql = `
  SELECT cm.*
  FROM "ConversationMedias" cm
  ${CONTACT_ID_WHERE_CLAUSE}
`;
// Queries used in other modules for JOINs
const onFkFilteredClause = (contactAlias) => `
  cm."contactId" = "${contactAlias}".id AND cm."accountSid" = "${contactAlias}"."accountSid"
`;
const selectCoalesceConversationMediasByContactId = (contactAlias) => `
  SELECT COALESCE(jsonb_agg(to_jsonb(cm)), '[]') AS  "conversationMedia"
  FROM "ConversationMedias" cm
  WHERE ${onFkFilteredClause(contactAlias)}
`;
exports.selectCoalesceConversationMediasByContactId = selectCoalesceConversationMediasByContactId;
