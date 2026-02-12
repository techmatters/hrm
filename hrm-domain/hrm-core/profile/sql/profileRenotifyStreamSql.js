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
exports.getProfilesToRenotifySql = void 0;
const profile_get_sql_1 = require("./profile-get-sql");
const RENOTIFY_PROFILE_SELECT_CLAUSE = `SELECT *
                                        FROM "Profiles" profiles
                                        WHERE profiles."accountSid" = $<accountSid>
                                            AND COALESCE(profiles."updatedAt", profiles."createdAt") BETWEEN COALESCE($<dateFrom>::TIMESTAMP WITH TIME ZONE, '-infinity') AND COALESCE($<dateTo>::TIMESTAMP WITH TIME ZONE, 'infinity')`;
const getProfilesToRenotifySql = () => `${(0, profile_get_sql_1.getProfilesSqlBase)(RENOTIFY_PROFILE_SELECT_CLAUSE, true)}
  ORDER BY COALESCE(profiles."updatedAt", profiles."createdAt")`;
exports.getProfilesToRenotifySql = getProfilesToRenotifySql;
