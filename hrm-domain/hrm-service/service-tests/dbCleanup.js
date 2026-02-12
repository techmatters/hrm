"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllTables = void 0;
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
const dbConnection_1 = require("./dbConnection");
const clearAllTables = async () => {
    await Promise.all([
        dbConnection_1.db.none('DELETE FROM "public"."ConversationMedias"'),
        dbConnection_1.db.none('DELETE FROM "public"."ContactJobs"'),
        dbConnection_1.db.none('DELETE FROM "public"."ProfilesToProfileFlags"'),
        dbConnection_1.db.none('DELETE FROM "public"."ProfilesToIdentifiers"'),
        dbConnection_1.db.none('DELETE FROM "public"."ProfileSections"'),
        dbConnection_1.db.none('DELETE FROM "public"."CSAMReports"'),
    ]);
    await dbConnection_1.db.none('DELETE FROM "public"."Contacts"');
    await Promise.all([
        dbConnection_1.db.none('DELETE FROM "public"."Identifiers"'),
        dbConnection_1.db.none('DELETE FROM "public"."Cases"'),
        dbConnection_1.db.none('DELETE FROM "public"."Profiles"'),
    ]);
};
exports.clearAllTables = clearAllTables;
