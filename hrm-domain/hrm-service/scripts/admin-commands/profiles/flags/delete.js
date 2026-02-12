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
exports.handler = exports.builder = exports.describe = exports.command = void 0;
const service_discovery_1 = require("@tech-matters/service-discovery");
const hrmInternalConfig_1 = require("../../../hrmInternalConfig");
exports.command = 'delete';
exports.describe = 'Delete an existing profile flag';
exports.builder = {
    e: {
        alias: 'environment',
        describe: 'environment (e.g. development, staging, production)',
        demandOption: true,
        type: 'string',
    },
    r: {
        alias: 'region',
        describe: 'region (e.g. us-east-1)',
        demandOption: true,
        type: 'string',
    },
    a: {
        alias: 'accountSid',
        describe: 'account SID',
        demandOption: true,
        type: 'string',
    },
    i: {
        alias: 'flagId',
        describe: 'the id of the flag to delete',
        demandOption: true,
        type: 'number',
    },
};
const handler = async ({ region, environment, accountSid, flagId }) => {
    try {
        const timestamp = new Date().getTime();
        const assumeRoleParams = {
            RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
            RoleSessionName: `hrm-admin-cli-${timestamp}`,
        };
        const { authKey, internalResourcesUrl } = await (0, service_discovery_1.getHRMInternalEndpointAccess)({
            region,
            environment,
            assumeRoleParams,
        });
        const url = (0, hrmInternalConfig_1.getAdminV0URL)(internalResourcesUrl, accountSid, `/profiles/flags/${flagId}`);
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${authKey}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to submit request: ${response.statusText}`);
        }
        const jsonResp = await response.json();
        console.info(JSON.stringify(jsonResp, null, 2));
    }
    catch (err) {
        console.error(`Failed to delete profile flag ${flagId} for account ${accountSid} (${region} ${environment})`, err instanceof Error ? err.message : String(err));
    }
};
exports.handler = handler;
