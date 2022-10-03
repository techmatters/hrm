import {
  SafeRouter as MockSafeRouter,
  publicEndpoint as mockPublicEndpoint,
} from '../src/permissions';
import { createService } from '../src/app';
import { openPermissions } from '../src/permissions/json-permissions';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';
const supertest = require('supertest');
import { accountSid, workerSid } from './mocks';

jest.mock('../src/routes', () => {
  const mockRouter = MockSafeRouter();
  const middlewareThatDontAuthorize = (req, res, next) => {
    req.unauthorize();
    next();
  };
  const middlewareThatAuthorizes = (req, res, next) => {
    req.authorize();
    next();
  };
  const defaultHandler = (req, res) => res.json({});

  mockRouter.get('/without-middleware', defaultHandler);
  mockRouter.get('/with-public-endpoint-middleware', mockPublicEndpoint, defaultHandler);
  mockRouter.get(
    '/with-middleware-that-dont-authorize',
    middlewareThatDontAuthorize,
    defaultHandler,
  );
  mockRouter.get('/with-middleware-that-authorizes', middlewareThatAuthorizes, defaultHandler);
  mockRouter.get(
    '/with-multiple-middlewares',
    middlewareThatDontAuthorize,
    middlewareThatAuthorizes,
    defaultHandler,
  );
  return {
    apiV0: () => mockRouter.expressRouter,
  };
});

const server = createService({
  permissions: openPermissions,
  authTokenLookup: () => 'picernic basket',
  enableProcessContactJobs: false,
}).listen();
const request = supertest.agent(server);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

const baseRoute = `/v0/accounts/${accountSid}`;

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(done => {
  proxiedEndpoints.stop().finally(() => {
    server.close(done);
  });
});

test('unauthorize endpoints with no middleware', async () => {
  const response = await request.get(`${baseRoute}/without-middleware`).set(headers);
  expect(response.status).toBe(401);
});

test('authorize endpoints with  publicEndpoint middleware', async () => {
  const response = await request.get(`${baseRoute}/with-public-endpoint-middleware`).set(headers);
  expect(response.status).toBe(200);
});

test('Unauthorize endpoints with middleware that dont authorize', async () => {
  const response = await request
    .get(`${baseRoute}/with-middleware-that-dont-authorize`)
    .set(headers);
  expect(response.status).toBe(401);
});

test('Authorizes endpoints with middleware that authorizes', async () => {
  const response = await request.get(`${baseRoute}/with-middleware-that-authorizes`).set(headers);
  expect(response.status).toBe(200);
});

test('Authorizes endpoints with multiple middlewares and one that authorizes', async () => {
  const response = await request.get(`${baseRoute}/with-multiple-middlewares`).set(headers);
  expect(response.status).toBe(200);
});
