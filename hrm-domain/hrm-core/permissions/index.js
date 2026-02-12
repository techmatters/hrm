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
exports.maxPermissions = exports.setupPermissions = exports.applyPermissions = exports.rulesMap = exports.actionsMaps = exports.publicEndpoint = exports.SafeRouter = void 0;
const rulesMap_1 = require("./rulesMap");
Object.defineProperty(exports, "rulesMap", { enumerable: true, get: function () { return rulesMap_1.rulesMap; } });
const initializeCanForRules_1 = require("./initializeCanForRules");
var safe_router_1 = require("./safe-router");
Object.defineProperty(exports, "SafeRouter", { enumerable: true, get: function () { return safe_router_1.SafeRouter; } });
Object.defineProperty(exports, "publicEndpoint", { enumerable: true, get: function () { return safe_router_1.publicEndpoint; } });
var actions_1 = require("./actions");
Object.defineProperty(exports, "actionsMaps", { enumerable: true, get: function () { return actions_1.actionsMaps; } });
const canCache = {};
/**
 * Applies the permissions if valid.
 * @throws Will throw if initializedCan is not a function
 */
const applyPermissions = (req, initializedCan) => {
    if (typeof initializedCan !== 'function')
        throw new Error(`Error in looked up permission rules: can is not a function.`);
    req.can = initializedCan;
};
exports.applyPermissions = applyPermissions;
const setupPermissions = (lookup) => async (req, res, next) => {
    const { accountSid } = req.user;
    const accountRules = await lookup.rules(accountSid);
    if (lookup.cachePermissions) {
        canCache[accountSid] = canCache[accountSid] ?? (0, initializeCanForRules_1.initializeCanForRules)(accountRules);
        const initializedCan = canCache[accountSid];
        (0, exports.applyPermissions)(req, initializedCan);
    }
    else {
        (0, exports.applyPermissions)(req, (0, initializeCanForRules_1.initializeCanForRules)(accountRules));
    }
    req.permissionRules = accountRules;
    return next();
};
exports.setupPermissions = setupPermissions;
exports.maxPermissions = {
    can: () => true,
    user: {
        accountSid: 'ACxxx',
        workerSid: 'WKxxx',
        roles: ['supervisor'],
        isSupervisor: true,
        isSystemUser: false,
    },
    permissionRules: rulesMap_1.rulesMap.open,
};
