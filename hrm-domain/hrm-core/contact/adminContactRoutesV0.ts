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
import {
  ManuallyTriggeredNotificationOperation,
  manuallyTriggeredNotificationOperations,
} from '@tech-matters/hrm-types';
import { publicEndpoint, SafeRouter } from '../permissions';
import { processContactsStream } from './contactsNotifyService';
import createError from 'http-errors';

const adminContactsRouter = SafeRouter();

// admin POST endpoint to reindex contacts. req body has accountSid, dateFrom, dateTo
adminContactsRouter.post(
  '/:notifyOperation',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const notifyOperation = req.params
      .broadcastType as ManuallyTriggeredNotificationOperation;
    if (!manuallyTriggeredNotificationOperations.includes(notifyOperation)) {
      throw createError(404);
    }
    console.log(`.......${notifyOperation}ing contacts......`, req, res);

    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const resultStream = await processContactsStream(
      hrmAccountId,
      dateFrom,
      dateTo,
      notifyOperation,
    );
    resultStream.on('error', err => {
      next(err);
    });
    res.status(200).setHeader('Content-Type', 'text/plain');
    resultStream.pipe(res);
  },
);

export default adminContactsRouter.expressRouter;
