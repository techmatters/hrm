import createError from 'http-errors';
import express from 'express';
import 'express-async-errors';
import cors from 'cors';

import httpLogger from './logging/httplogging';
import swagger from './swagger';
import { apiV0 } from './routes';
import { Permissions, setupPermissions } from './permissions';
import { jsonPermissions } from './permissions/json-permissions';
import { getAuthorizationMiddleware } from './middlewares/authorizationMiddleware';
import { addAccountSid } from './middlewares/addAccountSid';

type ServiceCreationOptions = Partial<{
  permissions: Permissions;
  authTokenLookup: (accountSid: string) => string;
}>;

export function createService({
  permissions = jsonPermissions,
  authTokenLookup,
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

  const authorizationMiddleware = getAuthorizationMiddleware(authTokenLookup);

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
