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

import {
  SafeRouter as MockSafeRouter,
  publicEndpoint as mockPublicEndpoint,
} from '@tech-matters/hrm-core/permissions/index';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { accountSid, workerSid } from './mocks';
import { headers, getRequest, getServer, useOpenRules } from './server';

jest.mock('@tech-matters/hrm-core/routes', () => {
  const mockRouter = MockSafeRouter();
  const middlewareThatBlocks = (req, res, next) => {
    req.block();
    next();
  };
  const middlewareThatPermits = (req, res, next) => {
    req.permit();
    next();
  };
  const defaultHandler = (req, res) => res.json({});

  mockRouter.get('/without-middleware', defaultHandler);
  mockRouter.get('/with-public-endpoint-middleware', mockPublicEndpoint, defaultHandler);
  mockRouter.get('/with-middleware-that-blocks', middlewareThatBlocks, defaultHandler);
  mockRouter.get('/with-middleware-that-permits', middlewareThatPermits, defaultHandler);
  mockRouter.get(
    '/with-multiple-middlewares',
    middlewareThatBlocks,
    middlewareThatPermits,
    defaultHandler,
  );
  return {
    HRM_ROUTES: [],
    apiV0: () => mockRouter.expressRouter,
  };
});

useOpenRules();
const server = getServer();
const request = getRequest(server);

const baseRoute = `/v0/accounts/${accountSid}`;

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

test('Unauthorize endpoints with no middleware', async () => {
  const response = await request.get(`${baseRoute}/without-middleware`).set(headers);
  expect(response.status).toBe(403);
});

test('authorize endpoints with  publicEndpoint middleware', async () => {
  const response = await request
    .get(`${baseRoute}/with-public-endpoint-middleware`)
    .set(headers);
  expect(response.status).toBe(200);
});

test('Blocks endpoints with middleware that dont permit', async () => {
  const response = await request
    .get(`${baseRoute}/with-middleware-that-blocks`)
    .set(headers);
  expect(response.status).toBe(403);
});

test('Permits endpoints with middleware that permits', async () => {
  const response = await request
    .get(`${baseRoute}/with-middleware-that-permits`)
    .set(headers);
  expect(response.status).toBe(200);
});

test('Permits endpoints with multiple middlewares and one that permits', async () => {
  const response = await request
    .get(`${baseRoute}/with-multiple-middlewares`)
    .set(headers);
  expect(response.status).toBe(200);
});
