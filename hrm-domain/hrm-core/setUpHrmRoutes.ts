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

import { Express } from 'express';
import { Permissions, setupPermissions } from './permissions';
import { apiV0, HRM_ROUTES } from './routes';
import {
  addAccountSidMiddleware,
  getAuthorizationMiddleware,
} from '@tech-matters/twilio-worker-auth';
import type { AuthSecretsLookup } from '@tech-matters/twilio-worker-auth';
import { getDbForAccount } from './dbConnection';

export const setUpHrmRoutes = (
  webServer: Express,
  authSecretsLookup: AuthSecretsLookup,
  rules: Permissions,
) => {
  const authorizationMiddleware = getAuthorizationMiddleware(authSecretsLookup);
  webServer.use(
    `/v0/accounts/:accountSid/test-connection-quick`,
    addAccountSidMiddleware,
    authorizationMiddleware,
    async (req, res) => {
      const db = await getDbForAccount(req.hrmAccountId);
      const result = await db.any('SELECT pg_sleep(10)');
      console.log('>>>> result', result);
      res.json(result);
    },
  );
  webServer.use(
    `/v0/accounts/:accountSid/test-connection`,
    addAccountSidMiddleware,
    authorizationMiddleware,
    async (req, res) => {
      const db = await getDbForAccount(req.hrmAccountId);
      const result = await db.any('SELECT pg_sleep(600)');
      console.log('>>>> result', result);
      res.json(result);
    },
  );
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
