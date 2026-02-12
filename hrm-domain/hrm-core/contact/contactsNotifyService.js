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
exports.processContactsStream = void 0;
const hrm_types_1 = require("@tech-matters/hrm-types");
const entityChangeNotify_1 = require("../notifications/entityChangeNotify");
const stream_1 = require("stream");
const contactDataAccess_1 = require("./contactDataAccess");
// TODO: move this to service initialization or constant package?
const highWaterMark = 1000;
const processContactsStream = async (accountSid, dateFrom, dateTo, operation) => {
    if (!hrm_types_1.manuallyTriggeredNotificationOperations.includes(operation)) {
        throw new Error(`Invalid operation: ${operation}`);
    }
    const searchParameters = {
        dateFrom,
        dateTo,
    };
    console.debug(`Querying DB for contacts to ${operation}`, searchParameters);
    const contactsStream = await (0, contactDataAccess_1.streamContactsAfterNotified)({
        accountSid,
        searchParameters,
        batchSize: highWaterMark,
    });
    console.debug(`Piping contacts to queue for ${operation}ing`, searchParameters);
    return contactsStream.pipe(new stream_1.Transform({
        objectMode: true,
        highWaterMark,
        async transform(contact, _, callback) {
            try {
                const { MessageId } = await (0, entityChangeNotify_1.publishContactChangeNotification)({
                    accountSid,
                    contact,
                    operation,
                });
                this.push(`${new Date().toISOString()}, ${accountSid}, contact id: ${contact.id} Success, MessageId ${MessageId}
              \n`);
            }
            catch (err) {
                this.push(`${new Date().toISOString()}, ${accountSid}, contact id: ${contact.id} Error: ${err.message?.replace('"', '""') || String(err)}\n`);
            }
            callback();
        },
    }));
};
exports.processContactsStream = processContactsStream;
