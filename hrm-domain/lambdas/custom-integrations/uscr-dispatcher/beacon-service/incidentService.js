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
exports.createIncident = void 0;
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const types_1 = require("@tech-matters/types");
const createIncident = async ({ environment, incidentParams, }) => {
    try {
        const [baseUrl, apiKey] = await Promise.all([
            (0, ssm_cache_1.getSsmParameter)(`/${environment}/hrm/custom-integration/uscr/beacon_base_url`),
            (0, ssm_cache_1.getSsmParameter)(`/${environment}/hrm/custom-integration/uscr/beacon_api_key`),
        ]);
        const fullUrl = `${baseUrl}/api/aselo/incidents`;
        const apiCallStart = Date.now();
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Token': apiKey,
            },
            body: JSON.stringify(incidentParams),
        });
        const apiCallMillis = Date.now() - apiCallStart;
        console.info(`[TRACER][incident dispatch] Beacon API responded after ${apiCallMillis}ms with status:`, response.status);
        if (!response.ok) {
            const error = await response.json();
            return (0, types_1.newErr)({
                error,
                message: 'Failed calling Beacon API',
            });
        }
        const data = (await response.json());
        return (0, types_1.newOk)({ data });
    }
    catch (err) {
        return (0, types_1.newErr)({
            message: err instanceof Error ? err.message : JSON.stringify(err),
            error: 'createIncident: unexpected error',
        });
    }
};
exports.createIncident = createIncident;
