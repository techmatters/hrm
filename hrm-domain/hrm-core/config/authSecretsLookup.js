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
exports.defaultAuthSecretsLookup = void 0;
const ssmConfigurationCache_1 = require("./ssmConfigurationCache");
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const lookupLocalOverride = (overrideEnvVarName, key) => {
    console.debug(`Checking for local overrides on ${overrideEnvVarName} (for key: ${key})`);
    const localPermissionsOverrideJson = process.env[overrideEnvVarName];
    if (localPermissionsOverrideJson) {
        const localOverridesMap = JSON.parse(localPermissionsOverrideJson);
        const localOverride = localOverridesMap[key];
        if (localOverride) {
            console.warn(`Overriding ${overrideEnvVarName}[${key}] with local value:`, localOverride);
            return localOverride;
        }
    }
    return undefined;
};
const authTokenLookup = async (accountSid) => {
    console.debug(`Looking up auth token for '${accountSid}'`);
    const localOverride = lookupLocalOverride('AUTH_TOKEN_LOCAL_OVERRIDE', accountSid);
    if (localOverride) {
        return localOverride;
    }
    const { authToken } = await (0, ssmConfigurationCache_1.getFromSSMCache)(accountSid);
    return authToken;
};
const staticKeyLookup = async (keyName) => {
    console.debug(`Looking up static key for '${keyName}'`);
    const localOverride = lookupLocalOverride('STATIC_KEYS_LOCAL_OVERRIDE', keyName);
    if (localOverride) {
        return localOverride;
    }
    try {
        return await (0, ssm_cache_1.getSsmParameter)(`/${process.env.NODE_ENV}/hrm/service/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/static_key/${keyName}`);
    }
    catch (error) {
        // Remove when a terraform apply has been done for all accounts
        if (error instanceof ssm_cache_1.SsmParameterNotFound && keyName.startsWith('AC')) {
            console.warn(`New internal API key not set up for ${keyName} yet, looking for legacy key`);
            return (0, ssm_cache_1.getSsmParameter)(`/${process.env.NODE_ENV}/twilio/${keyName}/static_key`);
        }
        else
            throw error;
    }
};
exports.defaultAuthSecretsLookup = {
    authTokenLookup,
    staticKeyLookup,
};
