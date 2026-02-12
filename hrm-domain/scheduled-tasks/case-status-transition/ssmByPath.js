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
exports.findSsmParametersByPath = void 0;
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const findSsmParametersByPath = async (path) => {
    const client = (0, ssm_cache_1.getSsmClient)();
    let nextToken;
    const foundParameters = [];
    do {
        const params = {
            MaxResults: 10, // 10 is max allowed by AWS
            Path: path,
            Recursive: true,
            WithDecryption: true,
        };
        if (nextToken)
            params.NextToken = nextToken;
        const command = new client_ssm_1.GetParametersByPathCommand(params);
        const resp = await client.send(command);
        foundParameters.push(...(resp.Parameters ?? []));
        nextToken = resp.NextToken;
    } while (nextToken);
    return foundParameters;
};
exports.findSsmParametersByPath = findSsmParametersByPath;
