/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import express, { Express } from 'express';
import 'express-async-errors';

import type { Permissions } from './permissions';
import { jsonPermissions, openPermissions } from './permissions/jsonPermissions';
import { setUpHrmRoutes } from './setUpHrmRoutes';
import {
  addAccountSidMiddleware,
  adminAuthorizationMiddleware,
  staticKeyAuthorizationMiddleware,
} from '@tech-matters/twilio-worker-auth';
import { defaultAuthSecretsLookup } from './config/authSecretsLookup';
import type { AuthSecretsLookup } from '@tech-matters/twilio-worker-auth';
import { adminApiV0, internalApiV0 } from './routes';
import { setupPermissions } from './permissions';

type ServiceCreationOptions = Partial<{
  permissions: Permissions;
  authSecretsLookup: AuthSecretsLookup;
  enableProcessContactJobs: boolean;
  webServer: Express;
}>;

export function configureService({
  permissions = jsonPermissions,
  authSecretsLookup = defaultAuthSecretsLookup,
  webServer = express(),
}: ServiceCreationOptions = {}) {
  webServer.get('/', (req, res) => {
    res.json({
      Message: 'HRM is up and running!',
    });
  });

  setUpHrmRoutes(webServer, authSecretsLookup, permissions);

  console.log(`${new Date().toLocaleString()}: app.js has been created`);

  return webServer;
}

export const configureInternalService = ({
  webServer,
  authSecretsLookup,
}: {
  webServer: Express;
  authSecretsLookup: AuthSecretsLookup;
}) => {
  webServer.get('/', (req, res) => {
    res.json({
      Message: 'HRM internal service is up and running!',
    });
  });

  webServer.use(
    '/admin/v0/accounts/:accountSid',
    addAccountSidMiddleware,
    adminAuthorizationMiddleware(authSecretsLookup.staticKeyLookup)('ADMIN_HRM'),
    setupPermissions(openPermissions),
    adminApiV0(),
  );

  webServer.use(
    '/internal/v0/accounts/:accountSid',
    addAccountSidMiddleware,
    staticKeyAuthorizationMiddleware(authSecretsLookup.staticKeyLookup),
    setupPermissions(openPermissions),
    internalApiV0(),
  );

  return webServer;
};
