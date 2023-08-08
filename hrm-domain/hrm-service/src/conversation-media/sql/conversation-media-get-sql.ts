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

export const ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."id" = $<id>`;
const CONTACT_ID_WHERE_CLAUSE = `WHERE r."accountSid" = $<accountSid> AND r."contactId" = $<contactId>`;

export const selectSingleConversationMediaByIdSql = `
  SELECT r.*
  FROM "ConversationMedias" r
  ${ID_WHERE_CLAUSE}
`;

export const selectConversationMediaByContactIdSql = `
  SELECT r.*
  FROM "ConversationMedias" r
  ${CONTACT_ID_WHERE_CLAUSE}
`;

// Queries used in other modules for JOINs

const onFkFilteredClause = (contactAlias: string) => `
  r."contactId" = "${contactAlias}".id AND r."accountSid" = "${contactAlias}"."accountSid"
`;

export const selectCoalesceConversationMediasByContactId = (contactAlias: string) => `
  SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "conversationMedia"
  FROM "ConversationMedias" r
  WHERE ${onFkFilteredClause(contactAlias)}
`;

export const leftJoinConversationMediasOnFK = (contactAlias: string) => `
  LEFT JOIN "ConversationMedias" r ON ${onFkFilteredClause(contactAlias)}
`;
