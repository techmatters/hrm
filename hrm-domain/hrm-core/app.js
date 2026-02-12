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
exports.configureInternalService = void 0;
exports.configureService = configureService;
const express_1 = __importDefault(require("express"));
require("express-async-errors");
const jsonPermissions_1 = require("./permissions/jsonPermissions");
const setUpHrmRoutes_1 = require("./setUpHrmRoutes");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const authSecretsLookup_1 = require("./config/authSecretsLookup");
const routes_1 = require("./routes");
const permissions_1 = require("./permissions");
function configureService({ permissions = jsonPermissions_1.jsonPermissions, authSecretsLookup = authSecretsLookup_1.defaultAuthSecretsLookup, webServer = (0, express_1.default)(), } = {}) {
    webServer.get('/', (req, res) => {
        res.json({
            Message: 'HRM is up and running!',
        });
    });
    (0, setUpHrmRoutes_1.setUpHrmRoutes)(webServer, authSecretsLookup, permissions);
    console.log(`${new Date().toLocaleString()}: app.js has been created`);
    return webServer;
}
const configureInternalService = ({ webServer, authSecretsLookup, }) => {
    webServer.get('/', (req, res) => {
        res.json({
            Message: 'HRM internal service is up and running!',
        });
    });
    webServer.use('/admin/v0/accounts/:accountSid', twilio_worker_auth_1.addAccountSidMiddleware, (0, twilio_worker_auth_1.adminAuthorizationMiddleware)(authSecretsLookup.staticKeyLookup)('ADMIN_HRM'), (0, permissions_1.setupPermissions)(jsonPermissions_1.openPermissions), (0, routes_1.adminApiV0)());
    webServer.use('/internal/v0/accounts/:accountSid', twilio_worker_auth_1.addAccountSidMiddleware, (0, twilio_worker_auth_1.staticKeyAuthorizationMiddleware)(authSecretsLookup.staticKeyLookup), (0, permissions_1.setupPermissions)(jsonPermissions_1.openPermissions), (0, routes_1.internalApiV0)());
    return webServer;
};
exports.configureInternalService = configureInternalService;
