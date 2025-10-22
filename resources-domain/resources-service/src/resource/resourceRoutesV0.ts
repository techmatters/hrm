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
import { resourceService } from './resourceService';
import { AccountSID } from '@tech-matters/types';
import createError from 'http-errors';
import { getDistinctStringAttributes } from './resourceService';

const resourceRoutes = () => {
  const router: IRouter = Router();

  const { getResource, searchResources, getResourceTermSuggestions } = resourceService();

  router.get('/resource/:resourceId', async (req, res) => {
    const referrableResource = await getResource(
      <AccountSID>req.hrmAccountId,
      req.params.resourceId,
    );
    if (!referrableResource) {
      throw createError(404);
    }
    res.json(referrableResource);
  });

  router.post('/search', async (req, res) => {
    const { limit, start } = req.query;

    const referrableResources = await searchResources(<AccountSID>req.hrmAccountId, {
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

  router.get('/suggest', async (req, res) => {
    const { size, prefix } = req.query;

    const suggestions = await getResourceTermSuggestions(<AccountSID>req.hrmAccountId, {
      size: parseInt((size as string) || '10'),
      prefix: prefix as string,
    });

    res.json(suggestions);
  });

  const listStringAttributesHandler = async (req: any, res: any) => {
    const { key: queryKey, language, valueStartsWith, allowDescendantKeys } = req.query;
    const key = req.params[0] || queryKey;

    if (!key || typeof key !== 'string') {
      res.status(400).json({
        message: 'invalid parameter key',
      });
      return;
    }

    if (language && typeof language !== 'string') {
      res.status(400).json({
        message: 'invalid parameter language',
      });
      return;
    }

    const attributes = await getDistinctStringAttributes(
      <AccountSID>req.hrmAccountId,
      key,
      language,
      valueStartsWith,
      allowDescendantKeys?.toLowerCase() === 'true',
    );

    res.json(attributes);
  };

  router.get('/list-string-attributes/*', listStringAttributesHandler);
  router.get('/list-string-attributes', listStringAttributesHandler);

  return router;
};
export default resourceRoutes;
