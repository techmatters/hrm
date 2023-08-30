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
import {
  Result,
  isErrorResult,
  newErrorResult,
  newSuccessResult,
} from '@tech-matters/types';

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
    } catch (err) {
      return next(createError(500, err.message));
    }
  });

  const parseActionGetPayload = ({
    objectType,
    objectId,
    action,
  }: {
    objectType?: string;
    objectId?: string;
    action: string;
  }): Result<{
    objectType: TargetKind;
    objectId: number;
  }> => {
    if (!objectType || !isTargetKind(objectType)) {
      return newErrorResult({ message: 'invalid objectType', statusCode: 400 });
    }

    const parsedId = parseInt(objectId, 10);
    if (!objectId || !Number.isInteger(parsedId)) {
      return newErrorResult({ message: 'invalid objectId', statusCode: 400 });
    }

    return newSuccessResult({ data: { objectType, objectId: parsedId } });
  };

  permissionsRouter.get('/:action', publicEndpoint, async (req, res, next) => {
    const { accountSid, user, can } = req;
    const { bucket, key } = req.query;
    const { action } = req.params;

    try {
      const parseResult = parseActionGetPayload({
        objectType: req.query.objectType,
        objectId: req.query.objectId,
        action,
      });

      if (isErrorResult(parseResult)) {
        return next(createError(parseResult.statusCode, parseResult.message));
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

      if (isErrorResult(canPerformResult)) {
        return next(createError(canPerformResult.statusCode, canPerformResult.message));
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

        if (isErrorResult(isValidLocationResult)) {
          return next(
            createError(isValidLocationResult.statusCode, isValidLocationResult.message),
          );
        }

        if (!isValidLocationResult.data) {
          return next(createError(403, 'Not allowed'));
        }
      }

      // TODO: what do we expect here?
      res.json({ message: 'all good :)' });
    } catch (err) {
      return next(
        createError(500, err instanceof Error ? err.message : JSON.stringify(err)),
      );
    }
  });

  return permissionsRouter.expressRouter;
};
