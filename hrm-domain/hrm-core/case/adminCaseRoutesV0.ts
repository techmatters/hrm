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
import { SafeRouter } from '../permissions';
import { reindexCasesStream } from './caseReindexService';
import { adminAuthorizationMiddleware } from '@tech-matters/twilio-worker-auth';

const adminContactsRouter = SafeRouter();

// admin POST endpoint to reindex contacts. req body has accountSid, dateFrom, dateTo
adminContactsRouter.post(
  '/reindex',
  adminAuthorizationMiddleware('ADMIN_HRM'),
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const resultStream = await reindexCasesStream(hrmAccountId, dateFrom, dateTo);

    resultStream.on('error', err => {
      next(err);
    });
    res.status(200).setHeader('Content-Type', 'text/plain');
    resultStream.pipe(res);
  },
);

export default adminContactsRouter.expressRouter;
