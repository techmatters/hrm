/**
 * SAFE ROUTER
 * This router ensures that an endpoint is only run if any middleware has authorized it previously.
 *
 * How does it work?
 * 1) It first runs a middleware that mark the request as not authorized yet.
 * 2) Just before the endpoint is run, another middleware checks if the request has been authorized.
 *
 * How to use it?
 * It's similar to Express Router (it actually uses it internally):
 *
 * const safeRouter = SafeRouter();
 * safeRouter.get('/:id', customPermissionMiddlewares, () => {});
 * safeRouter.post('/search', customPermissionMiddlewares, () => {});
 * // Integrate with Express using SafeRouter's field 'expressRouter'
 * router.use('/resource', safeRouter.expressRouter);
 *
 * IMPORTANT NOTE:
 * Any authorization middleware should set 'req.authorized' to true and call next()
 * to mark the request as authorized.
 * DO NOT set 'req.authorized' to false NEVER. In case a middleware cannot authorize the request, just
 * call next() and don't chenge 'req.authorized'.
 * This is point that should be improved in future versions!
 */
const { Router } = require('express');
const { unauthorized } = require('../utils');

/**
 * Sets req.authorized to false.
 * Subsequent middlewares may authorize the request.
 * This will be the first middleware in the chain.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const startAuthorization = (req, res, next) => {
  req.authorized = false;
  next();
};

/**
 * Checks the value of req.authorized.
 * If no middleware has authorized the request, it returns unauthorized.
 * This will be the last middleware in the chain.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const blockUnauthorized = (req, res, next) => (req.authorized ? next() : unauthorized(res));

/**
 * Includes two middlewares in the list of handlers:
 * 1) startAuthorization as the first middleware in the chain
 * 2) blockUnauthorized as the last middleware in the chain
 * @param {*} handlers
 */
const addPermissionMiddlewares = handlers => {
  const params = [...handlers];
  const endopintHandler = params.pop();
  return [startAuthorization, ...params, blockUnauthorized, endopintHandler];
};

// HTTP methods and the 'all' special method
const expressHttpMethods = ['all', 'get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

/**
 * Overrides the HTTP methods to include the permissions middlewares in the list of handlers
 * @param {*} router
 */
const overrideHTTPMethods = router =>
  Object.fromEntries(
    expressHttpMethods.map(method => [
      method,
      (path, ...handlers) => router[method](path, addPermissionMiddlewares(handlers)),
    ]),
  );

/**
 * SafeRouter function. It creates a router where the user can set the HTTP methods
 * and also exposes the field 'expressRouter' to integrate it with Express.
 */
const SafeRouter = args => {
  const router = Router(args);

  return {
    ...overrideHTTPMethods(router),
    expressRouter: router,
  };
};

module.exports = SafeRouter;
