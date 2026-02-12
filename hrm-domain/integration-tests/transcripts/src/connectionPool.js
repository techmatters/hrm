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
exports.db = exports.pgp = void 0;
const pg_promise_1 = __importDefault(require("pg-promise"));
const config = {
    username: 'hrm',
    password: null,
    database: 'hrmdb',
    host: 'localhost',
    port: 5432,
    dialect: 'postgres',
};
exports.pgp = (0, pg_promise_1.default)({});
exports.db = (0, exports.pgp)(`postgres://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${encodeURIComponent(config.database)}?&application_name=integration-test`);
const { builtins } = exports.pgp.pg.types;
[builtins.DATE, builtins.TIMESTAMP, builtins.TIMESTAMPTZ].forEach(typeId => {
    exports.pgp.pg.types.setTypeParser(typeId, value => {
        return value === null ? null : new Date(value).toISOString();
    });
});
