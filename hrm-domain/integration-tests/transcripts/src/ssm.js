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
exports.deleteParameter = exports.putParameter = void 0;
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const putParameter = async (parameterSuffix, value) => Promise.all(['test', 'local'].map(env => {
    console.log(`Creating /${env}/us-east-1/${parameterSuffix}`);
    return (0, ssm_cache_1.getSsmClient)().send(new client_ssm_1.PutParameterCommand({
        Name: `/${env}/us-east-1/${parameterSuffix}`,
        Value: value,
        Type: 'SecureString',
        Overwrite: true,
    }));
}));
exports.putParameter = putParameter;
const deleteParameter = async (parameterSuffix) => Promise.all(['test', 'local'].map(env => (0, ssm_cache_1.getSsmClient)().send(new client_ssm_1.DeleteParameterCommand({
    Name: `/${env}/us-east-1/${parameterSuffix}`,
}))));
exports.deleteParameter = deleteParameter;
