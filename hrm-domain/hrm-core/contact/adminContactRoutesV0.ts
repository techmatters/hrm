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

import type { Request, Response, NextFunction } from 'express';
import { isErr, mapHTTPError } from '@tech-matters/types';
import { SafeRouter, publicEndpoint } from '../permissions';
import { reindexContacts } from './contactsReindexService';

const adminContactsRouter = SafeRouter();

// admin POST endpoint to reindex contacts. req body has accountSid, dateFrom, dateTo
adminContactsRouter.post(
  '/reindex',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const result = await reindexContacts(hrmAccountId, dateFrom, dateTo);

    if (isErr(result)) {
      return next(
        mapHTTPError(result, {
          InvalidParameterError: 400,
        }),
      );
    }

    res.json(result.data);
  },
);

export default adminContactsRouter.expressRouter;
