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

// eslint-disable-next-line import/no-extraneous-dependencies
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { useOpenRules, getServer, getRequest } from './server';
import { clearAllTables } from './dbCleanup';
// eslint-disable-next-line import/no-extraneous-dependencies
import { WorkerSID } from '@tech-matters/types';
// eslint-disable-next-line import/no-extraneous-dependencies
import { mockDynamicDatabaseUserPasswordParameters } from './ssm';

export const setupServiceTests = (userTwilioWorkerId: WorkerSID) => {
  const server = getServer();
  const request = getRequest(server);

  beforeAll(async () => {
    await mockingProxy.start();
    await mockSuccessfulTwilioAuthentication(userTwilioWorkerId);
    await mockDynamicDatabaseUserPasswordParameters(await mockingProxy.mockttpServer());
  });

  afterAll(async () => {
    await Promise.all([mockingProxy.stop(), server.close()]);
  });

  beforeEach(async () => {
    useOpenRules();
  });

  afterEach(async () => {
    await clearAllTables();
  });

  return {
    server,
    request,
  };
};
