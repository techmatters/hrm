const supertest = require('supertest');
const { SafeRouter, publicEndpoint } = require('../../permissions');

const mockRouter = SafeRouter();
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
mockRouter.get('/with-public-endpoint-middleware', publicEndpoint, defaultHandler);
mockRouter.get('/with-middleware-that-dont-authorize', middlewareThatDontAuthorize, defaultHandler);
mockRouter.get('/with-middleware-that-authorizes', middlewareThatAuthorizes, defaultHandler);
mockRouter.get(
  '/with-multiple-middlewares',
  middlewareThatDontAuthorize,
  middlewareThatAuthorizes,
  defaultHandler,
);

jest.mock('../../routes', () => ({ apiV0: mockRouter.expressRouter }));
const app = require('../../app');

const server = app.listen();
const request = supertest.agent(server);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

test('unauthorize endpoints with no middleware', async () => {
  const response = await request.get('/v0/accounts/account-sid/without-middleware').set(headers);
  expect(response.status).toBe(401);
});

test('authorize endpoints with  publicEndpoint middleware', async () => {
  const response = await request
    .get('/v0/accounts/account-sid/with-public-endpoint-middleware')
    .set(headers);
  expect(response.status).toBe(200);
});

test('Unauthorize endpoints with middleware that dont authorize', async () => {
  const response = await request
    .get('/v0/accounts/account-sid/with-middleware-that-dont-authorize')
    .set(headers);
  expect(response.status).toBe(401);
});

test('Authorizes endpoints with middleware that authorizes', async () => {
  const response = await request
    .get('/v0/accounts/account-sid/with-middleware-that-authorizes')
    .set(headers);
  expect(response.status).toBe(200);
});

test('Authorizes endpoints with multiple middlewares and one that authorizes', async () => {
  const response = await request
    .get('/v0/accounts/account-sid/with-multiple-middlewares')
    .set(headers);
  expect(response.status).toBe(200);
});
