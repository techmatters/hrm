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
exports.notifyUpdateProfile = exports.notifyCreateProfile = void 0;
const entityChangeNotify_1 = require("../notifications/entityChangeNotify");
const profileDataAccess_1 = require("./profileDataAccess");
const doProfileChangeNotification = (operation) => async ({ accountSid, profileOrId, }) => {
    try {
        const profile = typeof profileOrId === 'object'
            ? profileOrId
            : await (0, profileDataAccess_1.getProfileById)()(accountSid, profileOrId, true);
        if (profile) {
            console.debug('Broadcasting profile', JSON.stringify(profile, null, 2));
            await (0, entityChangeNotify_1.publishEntityChangeNotification)(accountSid, 'profile', profile, operation);
        }
        else {
            console.error(`Profile ${profileOrId} (${accountSid}) not found to broadcast despite successfully updating data on it.`);
        }
    }
    catch (err) {
        console.error(`Error trying to broadcast profile: accountSid ${accountSid} profile ${typeof profileOrId === 'object' ? profileOrId.id : profileOrId}`, err);
    }
};
exports.notifyCreateProfile = doProfileChangeNotification('create');
exports.notifyUpdateProfile = doProfileChangeNotification('update');
