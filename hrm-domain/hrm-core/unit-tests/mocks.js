"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_CASE_ACTION_CONDITIONS = exports.OPEN_CONTACT_ACTION_CONDITIONS = exports.ALWAYS_CAN = exports.accountSid = exports.workerSid = void 0;
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const jsonPermissions_1 = require("../permissions/jsonPermissions");
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
exports.workerSid = 'WK-worker-sid';
exports.accountSid = 'ACCOUNT_SID';
exports.ALWAYS_CAN = {
    user: (0, twilio_worker_auth_1.newTwilioUser)(exports.accountSid, exports.workerSid, []),
    can: () => true,
    permissionRules: jsonPermissions_1.openRules,
    permissionCheckContact: undefined,
};
exports.OPEN_CONTACT_ACTION_CONDITIONS = [['everyone']];
exports.OPEN_CASE_ACTION_CONDITIONS = exports.OPEN_CONTACT_ACTION_CONDITIONS;
