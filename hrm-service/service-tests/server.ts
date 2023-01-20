// eslint-disable-next-line import/no-extraneous-dependencies
import supertest from 'supertest';

import { accountSid } from './mocks';
import { createService } from '../src/app';
import { openPermissions } from '../src/permissions/json-permissions';
import { RulesFile } from '../src/permissions/rulesMap';
import {
  configureDefaultPostMiddlewares,
  configureDefaultPreMiddlewares,
} from '@tech-matters/http/dist/webServerConfiguration';
import express from 'express';

let testRules: RulesFile;

export const useOpenRules = () => {
  testRules = openPermissions.rules(accountSid);
};

export const setRules = (rules: RulesFile) => {
  testRules = rules;
};

export const defaultConfig: {
  permissions?: {
    cachePermissions: boolean;
    rules: () => RulesFile;
  };
  authTokenLookup: () => string;
  enableProcessContactJobs: boolean;
} = {
  permissions: {
    cachePermissions: false,
    rules: () => testRules,
  },
  authTokenLookup: () => 'picernic basket',
  enableProcessContactJobs: false,
};

export const getServer = (config?: Partial<typeof defaultConfig>) => {
  const withoutService = configureDefaultPreMiddlewares(express());
  const withService = createService({
    ...defaultConfig,
    ...config,
    app: withoutService,
  });
  return configureDefaultPostMiddlewares(withService).listen();
};

export const getRequest = (server: ReturnType<typeof getServer>) => supertest.agent(server);

export const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};
