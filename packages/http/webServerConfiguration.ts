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

import express, { Express } from 'express';
import cors from 'cors';
import httpLogger from './logging';
import createError from 'http-errors';
import { ErrorRequestHandler } from 'express-serve-static-core';

export const configureDefaultPreMiddlewares = (webServer: Express): Express => {
  webServer.use(httpLogger);
  webServer.use(express.json());
  webServer.use(express.urlencoded({ extended: false }));
  webServer.use(cors());
  return webServer;
};
export const configureDefaultPostMiddlewares = (
  webServer: Express,
  includeErrorInResponse: boolean,
) => {
  webServer.use((req, res, next) => {
    next(createError(404));
  });
  const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.log(err);

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = includeErrorInResponse ? err : {};

    const error = includeErrorInResponse ? { message: err.message, error: err.stack } : {};

    res.status(err.status || 500);
    res.json(error);
    next();
  };
  webServer.use(errorHandler);
  return webServer;
};
