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
  app: Express;
}>;

export function createService({
  permissions = jsonPermissions,
  authTokenLookup,
  enableProcessContactJobs = enableProcessContactJobsFlag,
  app = express(),
}: ServiceCreationOptions = {}) {
  app.get('/', (req, res) => {
    res.json({
      Message: 'HRM is up and running!',
    });
  });

  setUpHrmRoutes(app, authTokenLookup, permissions);

  if (enableProcessContactJobs) {
    const processorIntervalId = processContactJobs();

    const gracefulExit = () => {
      clearInterval(processorIntervalId);
    };

    app.on('close', gracefulExit);
    // @ts-ignore
    app.close = () => {
      app.emit('close');
    };
  }

  console.log(`${new Date(Date.now()).toLocaleString()}: app.js has been created`);

  return app;
}
