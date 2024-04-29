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

// eslint-disable-next-line import/no-extraneous-dependencies
import supertest from 'supertest';

import { configureService } from '@tech-matters/hrm-core/app';
import { RulesFile } from '@tech-matters/hrm-core/permissions/rulesMap';
import {
  configureDefaultPostMiddlewares,
  configureDefaultPreMiddlewares,
} from '@tech-matters/http';
import express from 'express';
import { rulesMap } from '../../hrm-core/permissions';

const testRules: RulesFile = { ...rulesMap.open };

export const useOpenRules = () => {
  Object.assign(testRules, rulesMap.open);
};

export const setRules = (rules: Partial<RulesFile>) => {
  Object.assign(testRules, rules);
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
  const withService = configureService({
    ...defaultConfig,
    ...config,
    webServer: withoutService,
  });
  return configureDefaultPostMiddlewares(withService, true).listen();
};

export const getRequest = (server: ReturnType<typeof getServer>) =>
  supertest.agent(server);

export const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

export const basicHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Basic BBC`,
};
