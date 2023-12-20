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

import { SafeRouter, publicEndpoint, Permissions } from '../permissions';
import type { Request, Response } from 'express';
import createError from 'http-errors';
import {
  canPerformActionsOnObject,
  isFilesRelatedAction,
  isValidFileLocation,
} from './canPerformActionOnObject';
import { TargetKind, isTargetKind } from './actions';
import { TResult, newErr, isErr, newOk, ErrorResultKind } from '@tech-matters/types';

export default (permissions: Permissions) => {
  const permissionsRouter = SafeRouter();
  permissionsRouter.get('/', publicEndpoint, (req: Request, res: Response, next) => {
    try {
      const { accountSid } = req;
      if (!permissions.rules) {
        return next(
          createError(
            400,
            'Reading rules is not supported by the permissions implementation being used by this instance of the HRM service.',
          ),
        );
      }
      const rules = permissions.rules(accountSid);

      res.json(rules);
    } catch (error) {
      return next(createError(500, error.message));
    }
  });

  const parseActionGetPayload = ({
    objectType,
    objectId,
  }: {
    objectType?: string;
    objectId?: string;
  }): TResult<{
    objectType: TargetKind;
    objectId: number;
  }> => {
    if (!objectType || !isTargetKind(objectType)) {
      return newErr({
        message: 'invalid objectType',
        kind: ErrorResultKind.BadRequestError,
      });
    }

    const parsedId = parseInt(objectId, 10);
    if (!objectId || !Number.isInteger(parsedId)) {
      return newErr({
        message: 'invalid objectId',
        kind: ErrorResultKind.BadRequestError,
      });
    }

    return newOk({ data: { objectType, objectId: parsedId } });
  };

  permissionsRouter.get('/:action', publicEndpoint, async (req, res, next) => {
    const { accountSid, user, can } = req;
    const { bucket, key } = req.query;
    const { action } = req.params;

    try {
      const parseResult = parseActionGetPayload({
        objectType: req.query.objectType,
        objectId: req.query.objectId,
      });

      if (isErr(parseResult)) {
        return next(parseResult.intoHTTPError());
      }

      const { objectType, objectId } = parseResult.data;

      const canPerformResult = await canPerformActionsOnObject({
        accountSid,
        targetKind: objectType,
        actions: [action],
        objectId,
        can,
        user,
      });

      if (isErr(canPerformResult)) {
        return next(canPerformResult.intoHTTPError());
      }

      if (!canPerformResult.data) {
        return next(createError(403, 'Not allowed'));
      }

      if (isFilesRelatedAction(objectType, action)) {
        const isValidLocationResult = await isValidFileLocation({
          accountSid,
          targetKind: objectType,
          objectId,
          bucket,
          key,
        });

        if (isErr(isValidLocationResult)) {
          return next(isValidLocationResult.intoHTTPError());
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
