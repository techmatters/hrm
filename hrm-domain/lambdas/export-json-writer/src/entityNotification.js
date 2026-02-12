"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNormalisedNotificationPayload = exports.isCaseNotification = void 0;
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
const parseISO_1 = __importDefault(require("date-fns/parseISO"));
const isContactNotification = (notification) => Boolean(notification.contact);
const isCaseNotification = (notification) => Boolean(notification.case);
exports.isCaseNotification = isCaseNotification;
const isProfileNotification = (notification) => Boolean(notification.profile);
const getNormalisedNotificationPayload = (notification) => {
    if (isContactNotification(notification)) {
        return {
            entityType: 'contact',
            timestamp: (0, parseISO_1.default)(notification.contact.updatedAt ?? notification.contact.createdAt),
            payload: notification.contact,
        };
    }
    if ((0, exports.isCaseNotification)(notification)) {
        return {
            entityType: 'case',
            timestamp: (0, parseISO_1.default)(notification.case.updatedAt ?? notification.case.createdAt),
            payload: notification.case,
        };
    }
    if (isProfileNotification(notification)) {
        return {
            entityType: 'profile',
            timestamp: (0, parseISO_1.default)(notification.profile.updatedAt ?? notification.profile.createdAt),
            payload: notification.profile,
        };
    }
    return {
        timestamp: new Date(NaN),
        entityType: 'invalid',
        payload: null,
    };
};
exports.getNormalisedNotificationPayload = getNormalisedNotificationPayload;
