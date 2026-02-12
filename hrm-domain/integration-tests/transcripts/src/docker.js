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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runContainer = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
const docker = new dockerode_1.default();
const runContainer = async (imageName, env, { copyEnvironmentVariables = true, maxMemoryMb, } = {}) => {
    console.log('Starting image:', imageName, 'Env:', env);
    const [output, container] = await docker.run(imageName, [], process.stdout, {
        Env: Object.entries({
            ...(copyEnvironmentVariables ? process.env : {}),
            ...env,
        }).map(([key, value]) => `${key}=${value}`),
        HostConfig: {
            NetworkMode: 'hrm_default',
            ...(maxMemoryMb && {
                Memory: 1024 * 1024 * maxMemoryMb,
            }),
        },
    });
    await container.remove();
    if (output.StatusCode !== 0) {
        throw new Error(`Container from image ${imageName} exited with status code ${output.StatusCode}`);
    }
};
exports.runContainer = runContainer;
