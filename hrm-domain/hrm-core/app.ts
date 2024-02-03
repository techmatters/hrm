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
