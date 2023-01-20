import express, { Express } from 'express';
import 'express-async-errors';

import { Permissions } from './permissions';
import { jsonPermissions } from './permissions/json-permissions';
import { processContactJobs } from './contact-job/contact-job-processor';
import { enableProcessContactJobsFlag } from './featureFlags';
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
  enableProcessContactJobs = enableProcessContactJobsFlag,
  webServer = express(),
}: ServiceCreationOptions = {}) {
  webServer.get('/', (req, res) => {
    res.json({
      Message: 'HRM is up and running!',
    });
  });

  setUpHrmRoutes(webServer, authTokenLookup, permissions);

  if (enableProcessContactJobs) {
    const processorIntervalId = processContactJobs();

    const gracefulExit = () => {
      clearInterval(processorIntervalId);
    };

    webServer.on('close', gracefulExit);
    // @ts-ignore
    webServer.close = () => {
      webServer.emit('close');
    };
  }

  console.log(`${new Date().toLocaleString()}: app.js has been created`);

  return webServer;
}
