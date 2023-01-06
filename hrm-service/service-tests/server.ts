import supertest from 'supertest';

import { accountSid } from './mocks';
import { createService } from '../src/app';
import { openPermissions } from '../src/permissions/json-permissions';
import { RulesFile } from '../src/permissions/rulesMap';

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
  return createService({
    ...defaultConfig,
    ...config,
  }).listen();
};

export const getRequest = (server: ReturnType<typeof getServer>) => supertest.agent(server);

export const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};
