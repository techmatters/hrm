#!/usr/bin/env node
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
const express_1 = __importDefault(require("express"));
require("./defaultConfiguration");
/**
 * Module dependencies.
 */
console.log(new Date(Date.now()).toLocaleString() + ': trying to initialize www');
const app_1 = require("@tech-matters/hrm-core/app");
const authSecretsLookup_1 = require("@tech-matters/hrm-core/config/authSecretsLookup");
const resources_service_1 = require("@tech-matters/resources-service");
const debug_1 = __importDefault(require("debug"));
const http_1 = __importDefault(require("http"));
const http_2 = require("@tech-matters/http");
const debug = (0, debug_1.default)('hrm:server');
/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    const port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    if (port >= 0) {
        // port number
        return port;
    }
    return false;
}
const appWithoutServices = (0, http_2.configureDefaultPreMiddlewares)((0, express_1.default)());
const appWithHrmService = (0, app_1.configureService)({
    webServer: appWithoutServices,
    authSecretsLookup: authSecretsLookup_1.defaultAuthSecretsLookup,
});
const appWithResourcesService = (0, resources_service_1.configureResourcesService)({
    webServer: appWithHrmService,
    authSecretsLookup: authSecretsLookup_1.defaultAuthSecretsLookup,
});
const app = (0, http_2.configureDefaultPostMiddlewares)(appWithResourcesService, process.env.INCLUDE_ERROR_IN_RESPONSE?.toString()?.toLowerCase() === 'true');
const internalAppWithoutServices = (0, http_2.configureDefaultPreMiddlewares)((0, express_1.default)());
const inernalAppWithHrmService = (0, app_1.configureInternalService)({
    webServer: internalAppWithoutServices,
    authSecretsLookup: authSecretsLookup_1.defaultAuthSecretsLookup,
});
const internalAppWithResourcesService = (0, resources_service_1.configureInternalResourcesService)({
    webServer: inernalAppWithHrmService,
    authSecretsLookup: authSecretsLookup_1.defaultAuthSecretsLookup,
});
const internalApp = (0, http_2.configureDefaultPostMiddlewares)(internalAppWithResourcesService, process.env.INCLUDE_ERROR_IN_RESPONSE?.toString()?.toLowerCase() === 'true');
/**
 * Create HTTP server.
 */
console.log(new Date(Date.now()).toLocaleString() + ': trying to create server');
const server = http_1.default.createServer(app);
console.log(new Date(Date.now()).toLocaleString() + ': created server, about to listen');
const internalServer = http_1.default.createServer(internalApp);
console.log(new Date(Date.now()).toLocaleString() + ': created internal server, about to listen');
/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);
// Port to access services that are only available from inside AWS
const internalPort = normalizePort(process.env.INTERNAL_SERVICES_PORT || '3001');
internalApp.set('port', internalPort);
/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}
/**
 * Event listener for HTTP server "listening" event.
 */
const onListening = listenServer => () => {
    const addr = listenServer.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    debug('Listening on ' + bind);
    console.log('Log listening on ' + bind);
};
/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening(server));
internalServer.listen(internalPort);
internalServer.on('error', onError);
internalServer.on('listening', onListening(internalServer));
console.log(new Date(Date.now()).toLocaleString() + ': listening or not');
