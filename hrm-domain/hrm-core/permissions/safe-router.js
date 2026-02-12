"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeRouter = exports.publicEndpoint = void 0;
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
 * Integrate with Express using SafeRouter's field 'expressRouter'
 * router.use('/resource', safeRouter.expressRouter);
 *
 * IMPORTANT NOTE:
 * Any authorization middleware should call req.authorize()/req.unauthorize() and call next()
 * to mark the request as authorized/unauthorized.
 * DO NOT set 'req.authorized' directly.
 */
const express_1 = require("express");
const http_1 = require("@tech-matters/http");
/**
 * A middleware that just marks an endpoint as open.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const publicEndpoint = (req, res, next) => {
    req.permit();
    next();
};
exports.publicEndpoint = publicEndpoint;
/**
 * Adds permit(), block() and isPermitted() methods to the request
 * @param {*} req
 */
const createAuthorizationMethods = (req) => {
    req.permit = () => {
        req.permitted = true;
    };
    req.block = () => null;
    req.isPermitted = () => req.permitted;
};
/**
 * Sets req.authorized to false and create authorization methods.
 * Subsequent middlewares may authorize/unauthorize the request.
 * This will be the first middleware in the chain.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const startPermissibleRequest = (req, res, next) => {
    createAuthorizationMethods(req);
    req.permitted = false;
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
const blockNotPermitted = (req, res, next) => req.isPermitted() ? next() : (0, http_1.forbidden)(res);
/**
 * Includes two middlewares in the list of handlers:
 * 1) startPermissibleRequest as the first middleware in the chain
 * 2) blockUnauthorized as the last middleware in the chain
 * @param {*} handlers
 */
const addPermissionMiddlewares = handlers => {
    const params = [...handlers];
    const endpointHandler = params.pop();
    return [startPermissibleRequest, ...params, blockNotPermitted, endpointHandler];
};
// HTTP methods and the 'all' special method
const expressHttpMethods = [
    'all',
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head',
];
/**
 * Overrides the HTTP methods to include the permissions middlewares in the list of handlers
 * @param {*} router
 */
const overrideHTTPMethods = (router) => (Object.fromEntries(expressHttpMethods.map(method => [
    method,
    (path, ...handlers) => router[method](path, addPermissionMiddlewares(handlers)),
])));
/**
 * SafeRouter function. It creates a router where the user can set the HTTP methods
 * and also exposes the field 'expressRouter' to integrate it with Express.
 */
const SafeRouter = (args) => {
    const router = (0, express_1.Router)(args);
    return {
        ...overrideHTTPMethods(router),
        expressRouter: router,
    };
};
exports.SafeRouter = SafeRouter;
