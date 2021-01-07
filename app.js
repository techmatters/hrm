const createError = require('http-errors');
const express = require('express');
require('express-async-errors');
const logger = require('morgan');
const cors = require('cors');

const swagger = require('./swagger');
const { apiV0 } = require('./routes');

const app = express();
const apiKey = process.env.API_KEY;
const version = '0.3.6';

if (!apiKey) {
  throw new Error('Must specify API key');
}

console.log(`Starting HRM version ${version}`);

swagger.runWhenNotProduction(app);

console.log('After connect attempt');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get('/', (req, res) => {
  res.json({
    Message: 'Welcome to the HRM!',
  });
});

app.options('/contacts', cors());

function unauthorized(res) {
  const authorizationFailed = { error: 'Authorization failed' };
  console.log(`[authorizationMiddleware]: ${JSON.stringify(authorizationFailed)}`);
  res.status(401).json(authorizationFailed);
}

function authorizationMiddleware(req, res, next) {
  if (!req || !req.headers || !req.headers.authorization) {
    return unauthorized(res);
  }

  const base64Key = Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64');
  if (base64Key.toString('ascii') !== apiKey) {
    return unauthorized(res);
  }

  return next();
}

app.use(authorizationMiddleware);

/**
 * Middleware that adds the account sid (taken from path) to the request object, so we can use it in the routes.
 * NOTE: If we ever move this project to Typescript: https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5
 */
const addAccountSid = (req, res, next) => {
  req.accountSid = req.params.accountSid;
  return next();
};

app.use('/v0/accounts/:accountSid', addAccountSid, apiV0);

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  console.log(err);

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  const error =
    req.app.get('env') === 'development' ? { message: err.message, error: err.stack } : {};

  res.status(err.status || 500);
  res.json(error);
  next();
});

console.log(`${new Date(Date.now()).toLocaleString()}: app.js has been created`);

module.exports = app;
