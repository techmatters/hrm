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

import { isErr, mapHTTPError } from '@tech-matters/types';
import { SafeRouter, publicEndpoint } from '../permissions';
import * as profileController from './profile';
import createError from 'http-errors';

const adminProfilesRouter = SafeRouter();

adminProfilesRouter.get('/flags', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;

    const result = await profileController.getProfileFlags(accountSid);

    if (isErr(result)) {
      return next(mapHTTPError(result, { InternalServerError: 500 }));
    }

    res.json(result.data);
  } catch (err) {
    console.error(err);
    return next(createError(500, err.message));
  }
});

adminProfilesRouter.post('/flags', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { name } = req.body;

    const result = await profileController.createProfileFlag(accountSid, { name });

    if (isErr(result)) {
      return next(
        mapHTTPError(result, { InvalidParameterError: 400, InternalServerError: 500 }),
      );
    }

    res.json(result.data);
  } catch (err) {
    console.error(err);
    return next(createError(500, err.message));
  }
});

adminProfilesRouter.patch('/flags/:flagId', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { flagId } = req.params;
    const { name } = req.body;

    const result = await profileController.updateProfileFlagById(accountSid, flagId, {
      name,
    });

    if (isErr(result)) {
      return next(
        mapHTTPError(result, { InternalServerError: 500, InvalidParameterError: 400 }),
      );
    }

    if (!result.data) {
      return next(createError(404));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

adminProfilesRouter.delete('/flags/:flagId', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { flagId } = req.params;

    const result = await profileController.deleteProfileFlagById(flagId, accountSid);

    if (isErr(result)) {
      return next(mapHTTPError(result, { InternalServerError: 500 }));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

export default adminProfilesRouter.expressRouter;
