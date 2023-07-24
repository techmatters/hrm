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
import newAdminSearchService, {
  AdminSearchServiceConfiguration,
  ResponseType,
  SearchReindexParams,
} from './adminSearchService';

const adminSearchRoutes = (serviceConfig: AdminSearchServiceConfiguration) => {
  const router: IRouter = Router();
  const adminSearchService = newAdminSearchService(serviceConfig);

  router.post('/search/reindex', async ({ body, query }, res) => {
    const params: SearchReindexParams = body;
    if (params.resourceIds && !params.accountSid) {
      res.status(400).json({
        message: 'accountSid must be specified if resourceIds are specified',
      });
      return;
    }
    const result = await adminSearchService.reindexStream(
      body,
      query.responseType === 'verbose' ? ResponseType.VERBOSE : ResponseType.CONCISE,
    );
    res.status(200).json(result);
  });

  return router;
};

export default adminSearchRoutes;
