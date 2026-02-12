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
exports.renotifyCasesStream = void 0;
const hrm_types_1 = require("@tech-matters/hrm-types");
const caseService_1 = require("./caseService");
const permissions_1 = require("../permissions");
const formatISO_1 = __importDefault(require("date-fns/formatISO"));
const caseDataAccess_1 = require("./caseDataAccess");
const stream_1 = require("stream");
const entityChangeNotify_1 = require("../notifications/entityChangeNotify");
// TODO: move this to service initialization or constant package?
const highWaterMark = 1000;
const renotifyCasesStream = async (accountSid, dateFrom, dateTo, operation) => {
    if (!hrm_types_1.manuallyTriggeredNotificationOperations.includes(operation)) {
        throw new Error(`Invalid operation: ${operation}`);
    }
    const from = dateFrom ? (0, formatISO_1.default)(new Date(dateFrom)) : '-infinity';
    const to = dateTo ? (0, formatISO_1.default)(new Date(dateTo)) : 'infinity';
    console.debug(`Querying DB for cases to ${operation}`, from, to);
    const casesStream = await (0, caseDataAccess_1.streamCasesForRenotifying)({
        accountSid,
        filters: { from, to },
        batchSize: highWaterMark,
    });
    console.debug(`Piping cases to queue for ${operation}ing`, from, to);
    return casesStream.pipe(new stream_1.Transform({
        objectMode: true,
        highWaterMark,
        async transform(caseRecord, _, callback) {
            const caseObj = (0, caseService_1.caseRecordToCase)(caseRecord);
            try {
                const { MessageId } = await (0, entityChangeNotify_1.publishCaseChangeNotification)({
                    accountSid,
                    timeline: await (0, caseService_1.getTimelineForCase)(accountSid, permissions_1.maxPermissions, caseObj),
                    caseObj,
                    operation,
                });
                this.push(`${new Date().toISOString()}, ${accountSid}, case id: ${caseObj.id} Success, MessageId ${MessageId}
              \n`);
            }
            catch (err) {
                this.push(`${new Date().toISOString()}, ${accountSid}, case id: ${caseObj.id} Error: ${err.message?.replace('"', '""') || String(err)}\n`);
            }
            callback();
        },
    }));
};
exports.renotifyCasesStream = renotifyCasesStream;
