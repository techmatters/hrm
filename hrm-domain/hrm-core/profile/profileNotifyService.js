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
exports.renotifyProfilesStream = void 0;
const hrm_types_1 = require("@tech-matters/hrm-types");
const entityChangeNotify_1 = require("../notifications/entityChangeNotify");
const formatISO_1 = __importDefault(require("date-fns/formatISO"));
const stream_1 = require("stream");
const profileDataAccess_1 = require("./profileDataAccess");
// TODO: move this to service initialization or constant package?
const highWaterMark = 1000;
const renotifyProfilesStream = async (accountSid, dateFrom, dateTo, operation) => {
    if (!hrm_types_1.manuallyTriggeredNotificationOperations.includes(operation)) {
        throw new Error(`Invalid operation: ${operation}`);
    }
    const filters = {
        dateFrom: (0, formatISO_1.default)(new Date(dateFrom)),
        dateTo: (0, formatISO_1.default)(new Date(dateTo)),
    };
    console.debug(`Querying DB for profiles to ${operation}`, filters);
    const profilesStream = await (0, profileDataAccess_1.streamProfileForRenotifying)({
        accountSid,
        filters,
        batchSize: highWaterMark,
    });
    console.debug(`Piping profiles to queue for ${operation}ing`, filters);
    return profilesStream.pipe(new stream_1.Transform({
        objectMode: true,
        highWaterMark,
        async transform(profile, _, callback) {
            try {
                const { MessageId } = await (0, entityChangeNotify_1.publishProfileChangeNotification)({
                    accountSid,
                    operation,
                    profile,
                });
                this.push(`${new Date().toISOString()}, ${accountSid}, profile id: ${profile.id} Success, MessageId ${MessageId}
              \n`);
            }
            catch (err) {
                this.push(`${new Date().toISOString()}, ${accountSid}, profile id: ${profile.id} Error: ${err.message?.replace('"', '""') || String(err)}\n`);
            }
            callback();
        },
    }));
};
exports.renotifyProfilesStream = renotifyProfilesStream;
