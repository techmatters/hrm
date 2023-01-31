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
