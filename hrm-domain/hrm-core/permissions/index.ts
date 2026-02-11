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

import { SafeRouterRequest } from './safe-router';
import { rulesMap } from './rulesMap';
import { type InitializedCan, initializeCanForRules } from './initializeCanForRules';
import { type RulesFile } from './rulesMap';
import type { Request, Response, NextFunction } from 'express';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import type { AccountSID } from '@tech-matters/types';

export { SafeRouter, publicEndpoint } from './safe-router';
export { type Actions, actionsMaps } from './actions';
export { rulesMap };

declare global {
  namespace Express {
    export interface Request {
      permissionRules: RulesFile;
      can: InitializedCan;
    }
  }
}

const canCache: Record<string, InitializedCan> = {};

export type Permissions = {
  rules: (accountSid: AccountSID) => Promise<RulesFile>;
  cachePermissions: boolean;
};

/**
 * Applies the permissions if valid.
 * @throws Will throw if initializedCan is not a function
 */
export const applyPermissions = (req: Request, initializedCan: InitializedCan) => {
  if (typeof initializedCan !== 'function')
    throw new Error(`Error in looked up permission rules: can is not a function.`);

  req.can = initializedCan;
};

export const setupPermissions =
  (lookup: Permissions) => async (req: Request, res: Response, next: NextFunction) => {
    const { accountSid } = <TwilioUser>(<any>req).user;

    const accountRules = await lookup.rules(accountSid);
    if (lookup.cachePermissions) {
      canCache[accountSid] = canCache[accountSid] ?? initializeCanForRules(accountRules);
      const initializedCan = canCache[accountSid];
      applyPermissions(req, initializedCan);
    } else {
      applyPermissions(req, initializeCanForRules(accountRules));
    }

    req.permissionRules = accountRules;
    return next();
  };

export type RequestWithPermissions = SafeRouterRequest & {
  can: InitializedCan;
};

export const maxPermissions: {
  user: TwilioUser;
  can: () => boolean;
  permissionRules: RulesFile;
} = {
  can: () => true,
  user: {
    accountSid: 'ACxxx',
    workerSid: 'WKxxx',
    roles: ['supervisor'],
    isSupervisor: true,
    isSystemUser: false,
  },
  permissionRules: rulesMap.open,
};
