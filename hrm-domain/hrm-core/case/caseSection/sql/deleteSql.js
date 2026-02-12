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
exports.DELETE_CASE_SECTION_BY_ID = void 0;
exports.DELETE_CASE_SECTION_BY_ID = `
  DELETE FROM "CaseSections"
  WHERE "accountSid" = $<accountSid>
    AND "caseId" = $<caseId>
    AND "sectionType" = $<sectionType>
    AND "sectionId" = $<sectionId>
  RETURNING *`;
