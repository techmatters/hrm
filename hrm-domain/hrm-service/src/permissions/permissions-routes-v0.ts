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
import { canPerformActionsOnObject } from './canPerformActionOnObject';
import { isTargetKind, isValidSetOfActionsForTarget } from './actions';

export default (permissions: Permissions) => {
  const permissionsRouter = SafeRouter();
  permissionsRouter.get('/', publicEndpoint, (req: Request, res: Response, next) => {
    try {
      //@ts-ignore TODO: Improve our custom Request type to override Express.Request
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
    action,
    objectType,
    objectId,
  }: {
    action: string;
    objectType: any;
    objectId: any;
  }) => {
    if (!objectType || !isTargetKind(objectType)) {
      return { valid: false, message: 'invalid objectType' } as const;
    }
    if (!objectId || !Number.isInteger(parseInt(objectId, 10))) {
      return { valid: false, message: 'invalid objectId' } as const;
    }

    const actions = [action];

    if (!action || !isValidSetOfActionsForTarget(objectType, actions)) {
      return { valid: false, message: 'invalid action for objectType' } as const;
    }

    return {
      valid: true,
      validPayload: { actions, objectType, objectId },
    } as const;
  };

  permissionsRouter.get('/:action', publicEndpoint, async (req, res, next) => {
    const { accountSid, user, can } = req;

    try {
      const parsed = parseActionGetPayload({
        action: req.params.action,
        objectType: req.query.objectType,
        objectId: req.query.objectId,
      });
      if (!parsed.valid) {
        return next(createError(400, parsed.message));
      }

      const { objectType, actions, objectId } = parsed.validPayload;

      const canPerform = await canPerformActionsOnObject({
        accountSid,
        targetKind: objectType,
        actions,
        objectId,
        can,
        user,
      });

      res.json({ canPerform });
    } catch (err) {
      // TODO: better error handling?
      throw createError(500);
    }
  });

  return permissionsRouter.expressRouter;
};
