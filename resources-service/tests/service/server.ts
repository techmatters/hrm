// eslint-disable-next-line import/no-extraneous-dependencies
import supertest from 'supertest';
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  configureDefaultPostMiddlewares,
  configureDefaultPreMiddlewares,
} from '@tech-matters/http';
import express from 'express';

import { configureService } from '../../src/service';

export const defaultConfig: {
  authTokenLookup: (accountSid: string) => string;
} = {
  authTokenLookup: () => 'picernic basket',
};

export const getServer = (config?: Partial<typeof defaultConfig>) => {
  const withoutService = configureDefaultPreMiddlewares(express());
  const withService = configureService({
    ...defaultConfig,
    ...config,
    webServer: withoutService,
  });
  return configureDefaultPostMiddlewares(withService, true).listen();
};

export const getRequest = (server: ReturnType<typeof getServer>) => supertest.agent(server);

export const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};
