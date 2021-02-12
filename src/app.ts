import { Response } from './types';
const createError = require('http-errors');
const express = require('express');
require('express-async-errors');
const logger = require('morgan');
const cors = require('cors');
const TokenValidator = require('twilio-flex-token-validator').validator;

// const swagger = require('./swagger');
const { apiV0 } = require('./routes');

const app = express();
const apiKey = process.env.API_KEY;
const version = '0.3.6';

console.log(`Starting HRM version ${version}`);

// swagger.runWhenNotProduction(app);

console.log('After connect attempt');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get('/', (req, res) => {
  const response: Response = {
    Message: 'Welcome to the HRM!',
    Datetime: new Date(),
  };

  res.json(response);
});

app.options('/contacts', cors());

function unauthorized(res) {
  const authorizationFailed = { error: 'Authorization failed' };
  console.log(`[authorizationMiddleware]: ${JSON.stringify(authorizationFailed)}`);
  res.status(401).json(authorizationFailed);
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function authorizationMiddleware(req, res, next) {
  if (!req || !req.headers || !req.headers.authorization) {
    return unauthorized(res);
  }

  const { authorization } = req.headers;

  if (authorization.startsWith('Bearer')) {
    const token = authorization.replace('Bearer ', '');
    try {
      const { accountSid } = req;
      if (!accountSid) throw new Error('accountSid not specified in the request.');

      const authTokenKey = `TWILIO_AUTH_TOKEN_${accountSid}`;
      const authToken = process.env[authTokenKey];
      if (!authToken) throw new Error('authToken not provided for the specified accountSid.');

      // eslint-disable-next-line no-unused-vars
      const tokenResult = await TokenValidator(token, accountSid, authToken);
      // Here we can add tokenResult (worker, roles, etc) to the req object. Is this something we want? if above code is uncomented (auth with apiKey), that can lead to confusing flows, as sometimes it will exist and sometimes not.
      return next();
    } catch (err) {
      console.error('Token authentication failed: ', err);
    }
  }

  // for testing we use old api key (can't hit TokenValidator api with fake credentials as it results in The requested resource /Accounts/ACxxxxxxxxxx/Tokens/validate was not found)
  if (process.env.NODE_ENV === 'test' && authorization.startsWith('Basic')) {
    const base64Key = Buffer.from(authorization.replace('Basic ', ''), 'base64');
    if (base64Key.toString('ascii') === apiKey) {
      return next();
    }
    console.log('API Key authentication failed');
  }

  return unauthorized(res);
}

/**
 * Middleware that adds the account sid (taken from path) to the request object, so we can use it in the routes.
 * NOTE: If we ever move this project to Typescript: https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5
 */
const addAccountSid = (req, res, next) => {
  req.accountSid = req.params.accountSid;
  return next();
};

app.use('/v0/accounts/:accountSid', addAccountSid, authorizationMiddleware, apiV0);

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
