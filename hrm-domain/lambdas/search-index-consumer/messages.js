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
exports.groupMessagesByAccountSid = void 0;
const groupMessagesReducer = (accum, curr) => {
    const { messageId, body } = curr;
    const deserialized = JSON.parse(body);
    // This is compatibility code, can be removed when HRM v1.26.x is deployed everywhere
    deserialized.entityType = deserialized.entityType || deserialized.type;
    const message = deserialized;
    const { accountSid } = message;
    if (!accum[accountSid]) {
        return { ...accum, [accountSid]: [{ messageId, message }] };
    }
    return { ...accum, [accountSid]: [...accum[accountSid], { messageId, message }] };
};
const groupMessagesByAccountSid = (records) => records.reduce(groupMessagesReducer, {});
exports.groupMessagesByAccountSid = groupMessagesByAccountSid;
