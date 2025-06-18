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
import { isErr, isOk, mapHTTPError } from '@tech-matters/types';
import { SafeRouter, publicEndpoint } from '../permissions';
import * as profileController from './profileService';
import createError from 'http-errors';
import { renotifyProfilesStream } from './profileNotifyService';

const adminProfilesRouter = SafeRouter();

adminProfilesRouter.post(
  '/identifiers',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user } = req;
    const { identifier, name } = req.body;

    const result = await profileController.createProfileWithIdentifierOrError(
      hrmAccountId,
      { identifier: { identifier }, profile: { name } },
      { user },
    );

    if (isErr(result)) {
      return next(
        mapHTTPError(result, {
          InvalidParameterError: 400,
          IdentifierExistsError: 409,
        }),
      );
    }

    res.json(result.data);
  },
);

adminProfilesRouter.get('/flags', publicEndpoint, async (req: Request, res: Response) => {
  const { hrmAccountId } = req;

  const result = await profileController.getProfileFlags(hrmAccountId);

  res.json(result);
});

adminProfilesRouter.post(
  '/flags',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hrmAccountId, user } = req;
      const { name } = req.body;

      const result = await profileController.createProfileFlag(
        hrmAccountId,
        { name },
        { user },
      );

      if (isErr(result)) {
        return next(mapHTTPError(result, { InvalidParameterError: 400 }));
      }

      res.json(result);
    } catch (err) {
      console.error(err);
      return next(createError(500, err.message));
    }
  },
);

adminProfilesRouter.patch(
  '/flags/:flagId',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user } = req;
    const { flagId } = req.params;
    const { name } = req.body;

    const result = await profileController.updateProfileFlagById(
      hrmAccountId,
      parseInt(flagId, 10),
      {
        name,
      },
      { user },
    );

    if (isOk(result)) {
      if (!result.data) {
        return next(createError(404));
      }

      res.json({
        result: `Succesfully deleted flag ${result.data.name} (ID ${result.data.id})`,
      });
    } else {
      throw createError(400);
    }
  },
);

adminProfilesRouter.delete(
  '/flags/:flagId',
  publicEndpoint,
  async (req: Request, res: Response) => {
    const { hrmAccountId } = req;
    const { flagId } = req.params;

    const result = await profileController.deleteProfileFlagById(
      parseInt(flagId, 10),
      hrmAccountId,
    );

    res.json(result);
  },
);
// admin POST endpoint to renotify cases. req body has accountSid, dateFrom, dateTo
adminProfilesRouter.post(
  '/:notifyOperation',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const notifyOperation = req.params
      .notifyOperation as ManuallyTriggeredNotificationOperation;
    if (!manuallyTriggeredNotificationOperations.includes(notifyOperation)) {
      throw createError(404);
    }
    console.log(`.......${notifyOperation}ing profiles......`, req, res);
    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const resultStream = await renotifyProfilesStream(
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

export default adminProfilesRouter.expressRouter;
