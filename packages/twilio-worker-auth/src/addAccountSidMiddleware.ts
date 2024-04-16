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

import './index';
import type { Request, Response, NextFunction } from 'express';
import { AccountSID } from '@tech-matters/types';

declare global {
  namespace Express {
    export interface Request {
      accountSid?: AccountSID;
      hrmAccountId?: string;
    }
  }
}
/**
 * Middleware that adds the account sid (taken from path) to the request object, so we can use it in the routes.
 * NOTE: If we ever move this project to Typescript: https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5
 */
export const addAccountSidMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const [twilioAccountSid] = req.params.accountSid.split('-');
  req.accountSid = twilioAccountSid as AccountSID;
  req.hrmAccountId = req.params.accountSid;
  return next();
};
