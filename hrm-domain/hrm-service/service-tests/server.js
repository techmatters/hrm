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
exports.basicHeaders = exports.headers = exports.getRequest = exports.getInternalServer = exports.getServer = exports.defaultConfig = exports.setRules = exports.useOpenRules = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("@tech-matters/hrm-core/app");
const http_1 = require("@tech-matters/http");
const express_1 = __importDefault(require("express"));
const permissions_1 = require("../../hrm-core/permissions");
const testRules = { ...permissions_1.rulesMap.open };
const useOpenRules = () => {
    Object.assign(testRules, permissions_1.rulesMap.open);
};
exports.useOpenRules = useOpenRules;
const setRules = (rules) => {
    Object.assign(testRules, rules);
};
exports.setRules = setRules;
exports.defaultConfig = {
    permissions: {
        cachePermissions: false,
        rules: () => Promise.resolve(testRules),
    },
    authSecretsLookup: {
        authTokenLookup: () => Promise.resolve('picernic basket'),
        staticKeyLookup: keySuffix => Promise.resolve(process.env[`STATIC_KEY_${keySuffix}`] || ''),
    },
    enableProcessContactJobs: false,
};
const getServer = (config) => {
    const withoutService = (0, http_1.configureDefaultPreMiddlewares)((0, express_1.default)());
    const withService = (0, app_1.configureService)({
        ...exports.defaultConfig,
        ...config,
        webServer: withoutService,
    });
    return (0, http_1.configureDefaultPostMiddlewares)(withService, true).listen();
};
exports.getServer = getServer;
const getInternalServer = (config) => {
    const withoutService = (0, http_1.configureDefaultPreMiddlewares)((0, express_1.default)());
    const withService = (0, app_1.configureInternalService)({
        ...exports.defaultConfig,
        ...config,
        webServer: withoutService,
    });
    return (0, http_1.configureDefaultPostMiddlewares)(withService, true).listen();
};
exports.getInternalServer = getInternalServer;
const getRequest = (server) => supertest_1.default.agent(server);
exports.getRequest = getRequest;
exports.headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer bearing a bear (rawr)`,
};
exports.basicHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Basic BBC`,
};
