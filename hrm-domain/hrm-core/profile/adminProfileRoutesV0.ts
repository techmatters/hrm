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
import { isErr, isOk, mapHTTPError } from '@tech-matters/types';
import { SafeRouter, publicEndpoint } from '../permissions';
import * as profileController from './profileService';
import createError from 'http-errors';

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

export default adminProfilesRouter.expressRouter;
