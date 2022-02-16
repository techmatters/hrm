const createError = require('http-errors');
const express = require('express');
require('express-async-errors');
const cors = require('cors');
const TokenValidator = require('twilio-flex-token-validator').validator;
const crypto = require('crypto');

const httpLogger = require('./logging/httplogging');
const swagger = require('./swagger');
const { apiV0 } = require('./routes');
const { unauthorized } = require('./utils');
const { setupPermissions, User } = require('./permissions');

const app = express();
const apiKey = process.env.API_KEY;

swagger.runWhenNotProduction(app);

app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get('/', (req, res) => {
  res.json({
    Message: 'HRM is up and running!',
  });
});

app.options('/contacts', cors());

/**
 * Helper to whitelist the requests that other parts of the system (external to HRM, like Serverless functions) can perform on HRM.
 * Takes in the path and the method of the request and returns a boolean indicating if the endpoint can be accessed.
 * @param {string} path
 * @param {string} method
 *
 * IMPORTANT: This kind of static key acces should never be used to retrieve sensitive information.
 */
const canAccessResourceWithStaticKey = (path, method) => {
  if (path === '/postSurveys' && method === 'POST') return true;

  return false;
};

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
  const { accountSid } = req;
  if (!accountSid) return unauthorized(res);

  if (authorization.startsWith('Bearer')) {
    const token = authorization.replace('Bearer ', '');
    try {
      const authTokenKey = `TWILIO_AUTH_TOKEN_${accountSid}`;
      const authToken = process.env[authTokenKey];
      if (!authToken) throw new Error('authToken not provided for the specified accountSid.');

      const tokenResult = await TokenValidator(token, accountSid, authToken);
      req.user = new User(tokenResult.worker_sid, tokenResult.roles);
      return next();
    } catch (err) {
      console.error('Token authentication failed: ', err);
    }
  }

  if (authorization.startsWith('Basic')) {
    if (process.env.NODE_ENV === 'test' || process.env.HRM_PERMIT_BASIC_AUTHENTICATION) {
      // for testing we use old api key (can't hit TokenValidator api with fake credentials as it results in The requested resource /Accounts/ACxxxxxxxxxx/Tokens/validate was not found)
      const base64Key = Buffer.from(authorization.replace('Basic ', ''), 'base64');
      const isTestSecretValid = crypto.timingSafeEqual(base64Key, Buffer.from(apiKey));

      if (isTestSecretValid) {
        req.user = new User('worker-sid', []);
        return next();
      }

      console.log('API Key authentication failed');
    }

    if (canAccessResourceWithStaticKey(req.path, req.method)) {
      try {
        const staticSecretKey = `STATIC_KEY_${accountSid}`;
        const staticSecret = process.env[staticSecretKey];
        const requestSecret = authorization.replace('Basic ', '');

        const isStaticSecretValid =
          staticSecret &&
          requestSecret &&
          crypto.timingSafeEqual(Buffer.from(requestSecret), Buffer.from(staticSecret));

        if (isStaticSecretValid) {
          req.user = new User(`account-${accountSid}`, []);
          return next();
        }
      } catch (err) {
        console.error('Static key authentication failed: ', err);
      }
    }
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

app.use(
  '/v0/accounts/:accountSid',
  addAccountSid,
  authorizationMiddleware,
  setupPermissions,
  apiV0,
);

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  console.log(err, err.message, err.stack);

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
