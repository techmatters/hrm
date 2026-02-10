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

import { SafeRouter, publicEndpoint, Permissions } from './index';
import type { Request, Response } from 'express';
import createError from 'http-errors';
import {
  canPerformActionsOnObject,
  isFilesRelatedAction,
  isValidFileLocation,
} from './canPerformActionOnObject';
import { TargetKind, isTargetKind } from './actions';
import { TResult, newErr, isErr, newOk, mapHTTPError } from '@tech-matters/types';

export default (permissions: Permissions) => {
  const permissionsRouter = SafeRouter();
  permissionsRouter.get(
    '/',
    publicEndpoint,
    async (req: Request, res: Response, next) => {
      try {
        const { accountSid } = req.user;
        if (!permissions.rules) {
          return next(
            createError(
              400,
              'Reading rules is not supported by the permissions implementation being used by this instance of the HRM service.',
            ),
          );
        }
        const rules = await permissions.rules(accountSid);

        res.json(rules);
      } catch (error) {
        return next(createError(500, error.message));
      }
    },
  );

  const parseActionGetPayload = ({
    objectType,
    objectId,
  }: {
    objectType?: string;
    objectId?: string;
  }): TResult<
    'InvalidObjectType' | 'InternalServerError',
    {
      objectType: TargetKind;
      objectId: string;
    }
  > => {
    if (!objectType || !isTargetKind(objectType)) {
      return newErr({
        message: 'invalid objectType',
        error: 'InvalidObjectType',
      });
    }

    return newOk({ data: { objectType, objectId } });
  };

  permissionsRouter.get('/:action', publicEndpoint, async (req, res, next) => {
    const { user, can, hrmAccountId } = req;
    const { bucket, key } = req.query;
    const { action } = req.params;

    try {
      const parseResult = parseActionGetPayload({
        objectType: req.query.objectType,
        objectId: req.query.objectId,
      });

      if (isErr(parseResult)) {
        return next(
          mapHTTPError(parseResult, { InvalidObjectType: 400, InternalServerError: 500 }),
        );
      }

      const { objectType, objectId } = parseResult.data;

      const canPerformResult = await canPerformActionsOnObject({
        hrmAccountId,
        targetKind: objectType,
        actions: [action],
        objectId,
        can,
        user,
      });

      if (isErr(canPerformResult)) {
        return next(
          mapHTTPError(canPerformResult, {
            InvalidObjectType: 400,
            InternalServerError: 500,
          }),
        );
      }

      if (!canPerformResult.data) {
        return next(createError(403, 'Not allowed'));
      }

      if (isFilesRelatedAction(objectType, action)) {
        const isValidLocationResult = await isValidFileLocation({
          hrmAccountId,
          targetKind: objectType,
          objectId,
          bucket,
          key,
        });

        if (isErr(isValidLocationResult)) {
          return next(mapHTTPError(isValidLocationResult, { InternalServerError: 500 }));
        }

        if (!isValidLocationResult.data) {
          return next(createError(403, 'Not allowed'));
        }
      }

      // TODO: what do we expect here?
      res.json({ message: 'all good :)' });
    } catch (error) {
      return next(
        createError(500, error instanceof Error ? error.message : JSON.stringify(error)),
      );
    }
  });

  return permissionsRouter.expressRouter;
};
