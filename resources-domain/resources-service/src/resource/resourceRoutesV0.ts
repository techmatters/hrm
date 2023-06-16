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

import { IRouter, Request, Router } from 'express';
import { resourceService } from './resourceService';
import { AccountSID } from '@tech-matters/types';
import createError from 'http-errors';

const resourceRoutes = () => {
  const router: IRouter = Router();

  const { getResource, searchResourcesByName, searchResources } = resourceService();

  router.get('/resource/:resourceId', async (req, res) => {
    const referrableResource = await getResource(<AccountSID>req.accountSid, req.params.resourceId);
    if (!referrableResource) {
      throw createError(404);
    }
    res.json(referrableResource);
  });

  router.post(
    '/searchByName',
    async (req: Request<{ nameSubstring: string; ids: string[] }>, res) => {
      const { limit, start } = req.query;
      const referrableResources = await searchResourcesByName(<AccountSID>req.accountSid, {
        ...req.body,
        pagination: {
          limit: parseInt((limit as string) || '20'),
          start: parseInt((start as string) || '0'),
        },
      });
      res.json(referrableResources);
    },
  );

  router.post('/search', async (req, res) => {
    const { limit, start } = req.query;

    const referrableResources = await searchResources(<AccountSID>req.accountSid, {
      filters: {},
      generalSearchTerm: '',
      ...req.body,
      pagination: {
        limit: parseInt((limit as string) || '20'),
        start: parseInt((start as string) || '0'),
      },
    });

    res.json(referrableResources);
  });

  return router;
};
export default resourceRoutes;
