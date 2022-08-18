#!/usr/bin/env node

/**
 * Module dependencies.
 */
console.log(new Date(Date.now()).toLocaleString() + ': trying to initialize www');
import { createService } from '../app';
import debugFactory from 'debug';
import http from 'http';

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

const app = createService();
/**
 * Create HTTP server.
 */
console.log(new Date(Date.now()).toLocaleString() + ': trying to create server');
var server = http.createServer(app);
console.log(new Date(Date.now()).toLocaleString() + ': created server, about to listen');
/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

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

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log('Log listening on ' + bind);
}

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
console.log(new Date(Date.now()).toLocaleString() + ': listening or not');
