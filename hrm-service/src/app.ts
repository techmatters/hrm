import express, { Express } from 'express';
import 'express-async-errors';

// eslint-disable-next-line prettier/prettier
import type { Permissions } from './permissions';
import { jsonPermissions } from './permissions/json-permissions';
import { setUpHrmRoutes } from './setUpHrmRoutes';

type ServiceCreationOptions = Partial<{
  permissions: Permissions;
  authTokenLookup: (accountSid: string) => string;
  enableProcessContactJobs: boolean;
  webServer: Express;
}>;

export function configureService({
  permissions = jsonPermissions,
  authTokenLookup,
  webServer = express(),
}: ServiceCreationOptions = {}) {
  webServer.get('/', (req, res) => {
    res.json({
      Message: 'HRM is up and running!',
    });
  });

  setUpHrmRoutes(webServer, authTokenLookup, permissions);

  console.log(`${new Date().toLocaleString()}: app.js has been created`);

  return webServer;
}