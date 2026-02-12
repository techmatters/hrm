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
exports.setUpHrmRoutes = void 0;
const permissions_1 = require("./permissions");
const routes_1 = require("./routes");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const setUpHrmRoutes = (webServer, authSecretsLookup, rules) => {
    const authorizationMiddleware = (0, twilio_worker_auth_1.getAuthorizationMiddleware)(authSecretsLookup);
    routes_1.HRM_ROUTES.forEach(({ path }) => {
        webServer.use(`/v0/accounts/:accountSid${path}`, twilio_worker_auth_1.addAccountSidMiddleware, authorizationMiddleware, (0, permissions_1.setupPermissions)(rules));
    });
    webServer.use('/v0/accounts/:accountSid', (0, routes_1.apiV0)(rules));
};
exports.setUpHrmRoutes = setUpHrmRoutes;
