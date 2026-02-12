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
exports.openRules = exports.openPermissions = exports.jsonPermissions = exports.getPermissionsConfigName = void 0;
const ssmConfigurationCache_1 = require("../config/ssmConfigurationCache");
const rulesMap_1 = require("./rulesMap");
const getPermissionsConfigName = async (accountSid) => {
    const localPermissionsOverrideJson = process.env.PERMISSIONS_CONFIG_LOCAL_OVERRIDE;
    if (localPermissionsOverrideJson) {
        const localOverridesMap = JSON.parse(localPermissionsOverrideJson);
        const localOverride = localOverridesMap[accountSid];
        if (localOverride) {
            return localOverride;
        }
    }
    const { permissionConfig } = await (0, ssmConfigurationCache_1.getFromSSMCache)(accountSid);
    if (!permissionConfig)
        throw new Error(`No permissions set for account ${accountSid}.`);
    if (!rulesMap_1.rulesMap[permissionConfig])
        throw new Error(`Permissions rules with name ${permissionConfig} missing in rules map.`);
    return permissionConfig;
};
exports.getPermissionsConfigName = getPermissionsConfigName;
/**
 * @throws Will throw if there is no env var set for PERMISSIONS_${accountSid} or if it's an invalid key in rulesMap
 */
exports.jsonPermissions = {
    rules: async (accountSid) => {
        const permissionConfig = await (0, exports.getPermissionsConfigName)(accountSid);
        const rules = rulesMap_1.rulesMap[permissionConfig];
        if (!rules)
            throw new Error(`Cannot find rules for ${permissionConfig}`);
        return rules;
    },
    cachePermissions: true,
};
exports.openPermissions = {
    rules: () => Promise.resolve(rulesMap_1.rulesMap.open),
    cachePermissions: true,
};
exports.openRules = rulesMap_1.rulesMap.open;
