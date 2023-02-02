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
// eslint-disable-next-line prettier/prettier
import type { Request, Response } from 'express';
import createError from 'http-errors';

export default (permissions: Permissions) => {
  const permissionsRouter = SafeRouter();
  permissionsRouter.get('/', publicEndpoint, (req: Request, res: Response, next) => {
    try {
      //@ts-ignore TODO: Improve our custom Request type to override Express.Request
      const { accountSid } = req;
      if (!permissions.rules) {
        return next(createError(400, 'Reading rules is not supported by the permissions implementation being used by this instance of the HRM service.'));
      }
      const rules = permissions.rules(accountSid);

      res.json(rules);
    } catch (err) {
      return next(createError(500, err.message));
    }
  });

  return permissionsRouter.expressRouter;
};
