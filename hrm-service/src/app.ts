import createError from 'http-errors';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import { validator as TokenValidator } from 'twilio-flex-token-validator';
import crypto from 'crypto';

import httpLogger from './logging/httplogging';
import swagger from './swagger';
import { apiV0 } from './routes';
import { unauthorized } from './utils';
import { Permissions, setupPermissions, User } from './permissions';
import { jsonPermissions } from './permissions/json-permissions';

type ServiceCreationOptions = Partial<{
  permissions: Permissions;
  authTokenLookup: (accountSid: string) => string;
}>;

export function createService({
  permissions = jsonPermissions,
  authTokenLookup = accountSid => process.env[`TWILIO_AUTH_TOKEN_${accountSid}`],
}: ServiceCreationOptions = {}) {
  const app = express();

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
  const canAccessResourceWithStaticKey = (path, method): boolean => {
    return path === '/postSurveys' && method === 'POST';
  };

  type TokenValidatorResponse = { worker_sid: string; roles: string[] };

  const isWorker = (tokenResult: TokenValidatorResponse) =>
    Boolean(tokenResult.worker_sid) && tokenResult.worker_sid.startsWith('WK');
  const isGuest = (tokenResult: TokenValidatorResponse) =>
    Array.isArray(tokenResult.roles) && tokenResult.roles.includes('guest');

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
        const authToken = authTokenLookup(accountSid);
        if (!authToken) throw new Error('authToken not provided for the specified accountSid.');

        const tokenResult = <TokenValidatorResponse>(
          await TokenValidator(token, accountSid, authToken)
        );

        if (!isWorker(tokenResult) || isGuest(tokenResult)) {
          return unauthorized(res);
        }

        req.user = new User(tokenResult.worker_sid, tokenResult.roles);
        return next();
      } catch (err) {
        console.error('Token authentication failed: ', err);
      }
    }

    if (authorization.startsWith('Basic')) {
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
    setupPermissions(permissions),
    apiV0(permissions),
  );

  app.use((req, res, next) => {
    next(createError(404));
  });

  app.use((err, req, res, next) => {
    console.log(err);

    const includeErrorInResponse = process.env.INCLUDE_ERROR_IN_RESPONSE;

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = includeErrorInResponse ? err : {};

    const error = includeErrorInResponse ? { message: err.message, error: err.stack } : {};

    res.status(err.status || 500);
    res.json(error);
    next();
  });

  console.log(`${new Date(Date.now()).toLocaleString()}: app.js has been created`);

  return app;
}
