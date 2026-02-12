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
require("../mockDb");
const pg_query_stream_1 = __importDefault(require("pg-query-stream"));
const profileDataAccess_1 = require("../../profile/profileDataAccess");
jest.mock('pg-query-stream', () => {
    return jest.fn().mockReturnValue({});
});
const MockQueryStream = pg_query_stream_1.default;
describe('streamProfilesForRenotifying', () => {
    let lastQuerySql = '';
    beforeEach(() => {
        MockQueryStream.mockImplementation(sql => {
            lastQuerySql = sql;
            return {};
        });
    });
    test('No dates set - uses account, and min / max date placeholders in sql to create query stream', async () => {
        const promise = (0, profileDataAccess_1.streamProfileForRenotifying)({
            accountSid: 'AC4321',
            filters: { dateFrom: undefined, dateTo: undefined },
            batchSize: 1234,
        });
        console.debug('SQL Query:', lastQuerySql);
        expect(pg_query_stream_1.default).toHaveBeenCalledWith(expect.any(String), [], { batchSize: 1234 });
        expect(lastQuerySql).toContain('AC4321');
        expect(lastQuerySql).toContain("'-infinity'");
        expect(lastQuerySql).toContain("'infinity'");
        expect(promise).toBeTruthy();
    });
});
