import {
  SafeRouter as MockSafeRouter,
  publicEndpoint as mockPublicEndpoint,
} from '../src/permissions';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { accountSid, workerSid } from './mocks';
import { headers, getRequest, getServer, useOpenRules } from './server';

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
