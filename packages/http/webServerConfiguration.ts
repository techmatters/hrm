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
