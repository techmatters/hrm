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
exports.clearAllTables = void 0;
const connectionPool_1 = require("./connectionPool");
const clearAllTables = async () => {
    await Promise.all([
        connectionPool_1.db.none('DELETE FROM "public"."ConversationMedias"'),
        connectionPool_1.db.none('DELETE FROM "public"."ContactJobs"'),
        connectionPool_1.db.none('DELETE FROM "public"."ProfilesToProfileFlags"'),
        connectionPool_1.db.none('DELETE FROM "public"."ProfilesToIdentifiers"'),
        connectionPool_1.db.none('DELETE FROM "public"."ProfileSections"'),
        connectionPool_1.db.none('DELETE FROM "public"."CSAMReports"'),
    ]);
    await connectionPool_1.db.none('DELETE FROM "public"."Contacts"');
    await Promise.all([
        connectionPool_1.db.none('DELETE FROM "public"."Identifiers"'),
        connectionPool_1.db.none('DELETE FROM "public"."Cases"'),
        connectionPool_1.db.none('DELETE FROM "public"."Profiles"'),
    ]);
};
exports.clearAllTables = clearAllTables;
