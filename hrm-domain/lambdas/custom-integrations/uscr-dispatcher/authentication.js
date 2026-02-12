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
exports.authenticateRequest = void 0;
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const types_1 = require("@tech-matters/types");
const validAccountSidsMap = {
    development: ['/development/twilio/AS/account_sid'],
    staging: ['/staging/twilio/AS/account_sid', '/staging/twilio/USCR/account_sid'],
    production: ['/production/twilio/USCR/account_sid'],
};
const AuthenticationError = 'AuthenticationError';
const authenticateRequest = async ({ accountSid, authHeader, environment, }) => {
    try {
        const validAccountSids = await Promise.all(validAccountSidsMap[environment].map(key => (0, ssm_cache_1.getSsmParameter)(key)));
        if (!validAccountSids.includes(accountSid)) {
            return (0, types_1.newErr)({
                error: AuthenticationError,
                message: `Account ${accountSid} not allowed to call this service`,
            });
        }
        const authToken = await (0, ssm_cache_1.getSsmParameter)(`/${environment}/twilio/${accountSid}/auth_token`);
        const [type, token] = authHeader.split(' ');
        if (type !== 'Bearer') {
            return (0, types_1.newErr)({
                error: AuthenticationError,
                message: `Invalid auth type ${type}`,
            });
        }
        const result = await (0, twilio_worker_auth_1.twilioTokenValidator)({ accountSid, authToken, token });
        if ((0, types_1.isErr)(result)) {
            return result;
        }
        const staticKey = await (0, ssm_cache_1.getSsmParameter)(`/${environment}/twilio/${accountSid}/static_key`);
        return (0, types_1.newOk)({ data: { ...result.data, staticKey } });
    }
    catch (err) {
        return (0, types_1.newErr)({
            error: err,
            message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
        });
    }
};
exports.authenticateRequest = authenticateRequest;
