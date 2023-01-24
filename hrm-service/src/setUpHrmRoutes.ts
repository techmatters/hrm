import { Express } from 'express';
import { Permissions, setupPermissions } from './permissions';
import { apiV0, HRM_ROUTES } from './routes';
import {
  addAccountSidMiddleware,
  getAuthorizationMiddleware,
} from '@tech-matters/twilio-worker-auth';

export const setUpHrmRoutes = (
  webServer: Express,
  authTokenLookup: (accountSid: string) => string,
  rules: Permissions,
) => {
  const authorizationMiddleware = getAuthorizationMiddleware(authTokenLookup);
  HRM_ROUTES.forEach(({ path }) => {
    webServer.use(
      `/v0/accounts/:accountSid${path}`,
      addAccountSidMiddleware,
      authorizationMiddleware,
      setupPermissions(rules),
    );
  });
  webServer.use('/v0/accounts/:accountSid', apiV0(rules));
};
