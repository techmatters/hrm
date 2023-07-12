#!/usr/bin/env node
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

import express from 'express';

/**
 * Module dependencies.
 */
console.log(new Date(Date.now()).toLocaleString() + ': trying to initialize www');
import { configureService } from '../app';
import {
  configureInternalResourcesService,
  configureResourcesService,
} from '@tech-matters/resources-service';
import debugFactory from 'debug';
import http from 'http';
import {
  configureDefaultPostMiddlewares,
  configureDefaultPreMiddlewares,
} from '@tech-matters/http';

const debug = debugFactory('hrm:server');

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

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

const appWithoutServices = configureDefaultPreMiddlewares(express());
const appWithHrmService = configureService({ webServer: appWithoutServices });
const appWithResourcesService = configureResourcesService({
  webServer: appWithHrmService,
});
const app = configureDefaultPostMiddlewares(
  appWithResourcesService,
  Boolean(process.env.INCLUDE_ERROR_IN_RESPONSE),
);

const internalAppWithoutServices = configureDefaultPreMiddlewares(express());
const internalAppWithResourcesService = configureInternalResourcesService({
  webServer: internalAppWithoutServices,
});
const internalApp = configureDefaultPostMiddlewares(
  internalAppWithResourcesService,
  Boolean(process.env.INCLUDE_ERROR_IN_RESPONSE),
);
/**
 * Create HTTP server.
 */
console.log(new Date(Date.now()).toLocaleString() + ': trying to create server');
const server = http.createServer(app);
console.log(new Date(Date.now()).toLocaleString() + ': created server, about to listen');
const internalServer = http.createServer(internalApp);
console.log(
  new Date(Date.now()).toLocaleString() + ': created internal server, about to listen',
);
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

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

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
  var addr = listenServer.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
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
