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

export const ID_WHERE_CLAUSE = `WHERE cm."accountSid" = $<accountSid> AND cm."id" = $<id>`;
const CONTACT_ID_WHERE_CLAUSE = `WHERE cm."accountSid" = $<accountSid> AND cm."contactId" = $<contactId>`;

export const selectSingleConversationMediaByIdSql = `
  SELECT cm.*
  FROM "ConversationMedias" cm
  ${ID_WHERE_CLAUSE}
`;

export const selectConversationMediaByContactIdSql = `
  SELECT cm.*
  FROM "ConversationMedias" cm
  ${CONTACT_ID_WHERE_CLAUSE}
`;
