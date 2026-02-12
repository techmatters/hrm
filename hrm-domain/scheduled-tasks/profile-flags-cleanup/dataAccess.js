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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupProfileFlags = exports.db = void 0;
const types_1 = require("@tech-matters/types");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const database_connect_1 = require("@tech-matters/database-connect");
const db_1 = __importDefault(require("@tech-matters/hrm-core/config/db"));
exports.db = (0, database_connect_1.connectToPostgres)({
    ...db_1.default,
    applicationName: 'profile-flags-cleanup-scheduled-task',
});
const cleanupProfileFlags = async () => {
    try {
        const currentTimestamp = new Date().toISOString();
        const updatedBy = twilio_worker_auth_1.systemUser;
        const count = await exports.db.task(async (t) => t.one(`
          WITH "deleted" AS (DELETE FROM "ProfilesToProfileFlags" WHERE "validUntil" < $<currentTimestamp>::timestamp RETURNING *),

          -- trigger an update on profiles to keep track of who associated
          "updatedProfiles" AS (
            UPDATE "Profiles" "profiles"
            SET "updatedBy" = $<updatedBy>, "updatedAt" = $<currentTimestamp>::timestamp
            FROM deleted
            WHERE "profiles"."accountSid" = "deleted"."accountSid" AND "profiles"."id" = "deleted"."profileId"
          )

          SELECT COUNT(*) FROM deleted;
        `, { currentTimestamp, updatedBy }));
        return (0, types_1.newOk)({ data: count });
    }
    catch (err) {
        return (0, types_1.newErr)({
            message: err instanceof Error ? err.message : String(err),
            error: 'InternalServerError',
        });
    }
};
exports.cleanupProfileFlags = cleanupProfileFlags;
