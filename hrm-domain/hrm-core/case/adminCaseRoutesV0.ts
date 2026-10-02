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

import {
  ManuallyTriggeredNotificationOperation,
  manuallyTriggeredNotificationOperations,
} from '@tech-matters/hrm-types';

import type { Request, Response, NextFunction } from 'express';
import { isErr, mapHTTPError } from '@tech-matters/types';
import { publicEndpoint, SafeRouter } from '../permissions';
import { renotifyCasesStream } from './caseNotifyService';
import * as caseApi from './caseService';
import createError from 'http-errors';

const adminCasesRouter = SafeRouter();

adminCasesRouter.post('/', publicEndpoint, async (req, res) => {
  const { hrmAccountId, user } = req;
  const createdCase = await caseApi.createCase(req.body, hrmAccountId, user.workerSid);
  res.json(createdCase);
});

adminCasesRouter.get('/:caseId', publicEndpoint, async (req, res) => {
  const { hrmAccountId, user } = req;
  const { caseId } = req.params;
  const caseRecord = await caseApi.getCase(caseId, hrmAccountId, { user });
  console.info(
    `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Case read, case id: ${caseId}`,
  );
  if (!caseRecord) {
    throw createError(404);
  }
  res.json(caseRecord);
});

adminCasesRouter.delete(
  '/:caseId',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user } = req;
    const { caseId } = req.params;
    const result = await caseApi.deleteCaseById({ accountSid: hrmAccountId, caseId });
    if (isErr(result)) {
      return next(
        mapHTTPError(result, { DeleteLinkedCaseError: 409, DatabaseError: 500 }),
      );
    }
    if (!result.data) {
      return next(createError(404));
    }
    console.info(
      `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Case delete, case id: ${caseId}`,
    );
    res.sendStatus(200);
  },
);

// A future POST /:caseId here would collide with :notifyOperation below.
// admin POST endpoint to renotify cases. req body has accountSid, dateFrom, dateTo
adminCasesRouter.post(
  '/:notifyOperation',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const notifyOperation = req.params
      .notifyOperation as ManuallyTriggeredNotificationOperation;
    if (!manuallyTriggeredNotificationOperations.includes(notifyOperation)) {
      return next('route');
    }
    console.log(`.......${notifyOperation}ing cases......`, req, res);
    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const resultStream = await renotifyCasesStream(
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

export default adminCasesRouter.expressRouter;
