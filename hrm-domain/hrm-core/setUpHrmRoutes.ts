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
import { HrmAccountId } from '@tech-matters/types';

export const setUpHrmRoutes = (
  webServer: Express,
  authTokenLookup: (accountSid: HrmAccountId) => string,
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
