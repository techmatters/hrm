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

export const SELECT_RESOURCE_REFERENCE_ATTRIBUTES_BY_LIST_SQL = `
  SELECT "id", "value","language","info" FROM "ResourceReferenceStringAttributeValues" 
  WHERE "accountSid" = $<accountSid> AND 
  "list" = $<list> AND 
  ($<language> IS NULL OR "language"=$<language>) AND 
  ($<valueLikePattern> IS NULL OR "value" LIKE $<valueLikePattern>)`;
