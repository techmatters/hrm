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
exports.getDbForAccount = exports.db = exports.getDbForAdmin = exports.pgp = void 0;
const database_connect_1 = require("@tech-matters/database-connect");
const db_1 = __importDefault(require("./config/db"));
const featureFlags_1 = require("./featureFlags");
var database_connect_2 = require("@tech-matters/database-connect");
Object.defineProperty(exports, "pgp", { enumerable: true, get: function () { return database_connect_2.pgp; } });
let dbWithAdmin;
const getDbForAdmin = () => {
    // Instantiate lazily because only the poller instance uses this
    if (!dbWithAdmin) {
        dbWithAdmin = (0, database_connect_1.connectToPostgres)({
            ...db_1.default,
            applicationName: 'hrm-service',
        });
    }
    return dbWithAdmin;
};
exports.getDbForAdmin = getDbForAdmin;
exports.db = (0, database_connect_1.connectToPostgres)({
    ...db_1.default,
    applicationName: 'hrm-service',
});
exports.getDbForAccount = featureFlags_1.enableDbUserPerAccount
    ? (0, database_connect_1.connectToPostgresWithDynamicUser)({
        ...db_1.default,
        applicationName: 'hrm-service',
    }, 'hrm_account_', 'hrm_service', accountSid => `/${process.env.NODE_ENV}/hrm/${accountSid}/database/password`)
    : () => Promise.resolve((0, exports.getDbForAdmin)());
