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

import express from 'express';
import 'express-async-errors';
import {
  addAccountSidMiddleware,
  getAuthorizationMiddleware,
} from '@tech-matters/twilio-worker-auth';
import generateCloudSearchConfig, { CloudSearchConfig } from './config/cloud-search';
import { apiV0 } from './routes';

type ResourceServiceCreationOptions = {
  webServer: ReturnType<typeof express>;
  authTokenLookup?: (accountSid: string) => string;
  cloudSearchConfig?: CloudSearchConfig;
};

export const configureService = ({
  webServer,
  authTokenLookup,
  cloudSearchConfig = generateCloudSearchConfig(),
}: ResourceServiceCreationOptions) => {
  const authorizationMiddleware = getAuthorizationMiddleware(authTokenLookup);
  webServer.use(
    '/v0/accounts/:accountSid/resources',
    addAccountSidMiddleware,
    authorizationMiddleware,
    apiV0(cloudSearchConfig),
  );
  return webServer;
};
