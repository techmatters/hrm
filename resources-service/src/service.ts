import express from 'express';
import 'express-async-errors';
import { apiV0 } from './routes';
import {
  addAccountSidMiddleware,
  getAuthorizationMiddleware,
} from '@tech-matters/twilio-worker-auth';

type ResourceServiceCreationOptions = {
  webServer: ReturnType<typeof express>;
  authTokenLookup: (accountSid: string) => string;
};

export const configureService = ({
  webServer,
  authTokenLookup,
}: ResourceServiceCreationOptions) => {
  const authorizationMiddleware = getAuthorizationMiddleware(authTokenLookup);
  webServer.use(
    '/v0/accounts/:accountSid/resources',
    addAccountSidMiddleware,
    authorizationMiddleware,
    apiV0(),
  );
  return webServer;
};
