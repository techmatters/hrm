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
exports.SELECT_CASE_SECTIONS = void 0;
/**
 * Is this FILTER (WHERE cs."caseId" IS NOT NULL) needed? Won't cs."caseId" always be not null as "caseId" is part of the PK?
 */
exports.SELECT_CASE_SECTIONS = `SELECT
         COALESCE(jsonb_agg(DISTINCT cs.*) FILTER (WHERE cs."caseId" IS NOT NULL), '[]') AS "caseSections"
                     FROM "CaseSections" cs
                     WHERE cs."caseId" = cases.id AND cs."accountSid" = cases."accountSid"`;
