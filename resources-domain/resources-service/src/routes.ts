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

import { IRouter, Router } from 'express';
import resourceRoutes from './resource/resourceRoutesV0';
import importRoutes from './import/importRoutesV0';
import adminSearchRoutes from './admin/adminSearchRoutesV0';
import { AdminSearchServiceConfiguration } from './admin/adminSearchService';
import referenceAttributeRoutes from './referenceAttributes/referenceAttributeRoutesV0';

export const apiV0 = () => {
  const router: IRouter = Router();

  router.use(resourceRoutes());
  router.use('/reference-attributes', referenceAttributeRoutes());
  return router;
};

export const internalApiV0 = () => {
  const router: IRouter = Router();

  router.use(importRoutes());
  return router;
};

export const adminApiV0 = (config: AdminSearchServiceConfiguration) => {
  const router: IRouter = Router();

  router.use(adminSearchRoutes(config));
  return router;
};
