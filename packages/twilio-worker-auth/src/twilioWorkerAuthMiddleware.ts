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

import crypto from 'crypto';

import {
  newAccountSystemUser,
  newGlobalSystemUser,
  newTwilioUser,
  TwilioUser,
} from './twilioUser';
import { unauthorized } from '@tech-matters/http';
import type { Request, Response, NextFunction } from 'express';
import {
  getTwilioAccountSidFromHrmAccountId,
  isErr,
  WorkerSID,
} from '@tech-matters/types';
import { twilioTokenValidator } from './twilioTokenValidator';

export type AuthSecretsLookup = {
  authTokenLookup: (accountSid: string) => Promise<string>;
  staticKeyLookup: (accountSid: string) => Promise<string>;
};

declare global {
  namespace Express {
    export interface Request {
      user?: TwilioUser;
    }
  }
}

/**
 * Helper to whitelist the requests that other parts of the system (external to HRM, like Serverless functions) can perform on HRM.
 * Takes in the path and the method of the request and returns a boolean indicating if the endpoint can be accessed.
 * @param {string} path
 * @param {string} method
 *
 * IMPORTANT: This kind of static key access should never be used to retrieve sensitive information.
 */
const canAccessResourceWithStaticKey = (path: string, method: string): boolean => {
  // If the requests is to create a new post survey record, grant access
  if (path.endsWith('/postSurveys') && method === 'POST') return true;

  // If the requests is retrieve the list of flags associated to a given identifier, grant access
  if (/\/profiles\/identifier\/[^/]+\/flags$/.test(path) && method === 'GET') return true;

  return false;
};

const authenticateWithStaticKey =
  (staticKeyLookup: AuthSecretsLookup['staticKeyLookup']) =>
  async (req: Request, keySuffix: string, user: TwilioUser): Promise<boolean> => {
    if (!req.headers) return false;
    const {
      headers: { authorization },
    } = req;

    if (keySuffix && authorization && authorization.startsWith('Basic')) {
      try {
        const requestSecret = authorization.replace('Basic ', '');
        console.debug(`Authenticating against static key ${keySuffix} `);
        const staticSecret = await staticKeyLookup(keySuffix);

        const isStaticSecretValid =
          staticSecret &&
          requestSecret &&
          crypto.timingSafeEqual(Buffer.from(requestSecret), Buffer.from(staticSecret));

        if (isStaticSecretValid) {
          console.debug(
            `Successfully against static key ${keySuffix} with ${requestSecret} `,
          );
          req.user = user;
          return true;
        }
      } catch (err) {
        console.warn(`Static key authentication failed for ${keySuffix}: `, err);
      }
    }
    return false;
  };

export const getAuthorizationMiddleware =
  ({ authTokenLookup, staticKeyLookup }: AuthSecretsLookup) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req || !req.headers || !req.headers.authorization) {
      return unauthorized(res);
    }

    const { authorization } = req.headers;
    const accountSid = getTwilioAccountSidFromHrmAccountId(req.hrmAccountId);
    if (!accountSid) return unauthorized(res);

    if (authorization.startsWith('Bearer')) {
      const token = authorization.replace('Bearer ', '');
      try {
        const authToken = await authTokenLookup(accountSid);
        if (!authToken) {
          console.error(`authToken not provided for the accountSid ${accountSid}.`);
          return unauthorized(res);
        }

        const tokenResult = await twilioTokenValidator({ accountSid, authToken, token });

        if (isErr(tokenResult)) {
          console.error(tokenResult.error);
          return unauthorized(res);
        }

        req.user = newTwilioUser(
          accountSid,
          tokenResult.data.worker_sid as WorkerSID,
          tokenResult.data.roles,
        );
        return next();
      } catch (err) {
        console.error('Token authentication failed: ', err);
      }
    }

    if (
      canAccessResourceWithStaticKey(req.originalUrl, req.method) &&
      (await authenticateWithStaticKey(staticKeyLookup)(
        req,
        accountSid,
        newAccountSystemUser(accountSid),
      ))
    )
      return next();

    return unauthorized(res);
  };

export const staticKeyAuthorizationMiddleware =
  (staticKeyLookup: AuthSecretsLookup['staticKeyLookup']) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const accountSid = getTwilioAccountSidFromHrmAccountId(req.hrmAccountId);
    if (!accountSid) {
      throw new Error(
        'staticKeyAuthorizationMiddleware invoked with invalid request, req.accountSid missing',
      );
    }

    if (
      await authenticateWithStaticKey(staticKeyLookup)(
        req,
        accountSid,
        newAccountSystemUser(accountSid),
      )
    )
      return next();
    return unauthorized(res);
  };

// TODO: do we want to differentiate what is actually system vs admin?
export const systemUser = 'system';
export const adminAuthorizationMiddleware =
  (staticKeyLookup: AuthSecretsLookup['staticKeyLookup']) =>
  (keySuffix: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (
      await authenticateWithStaticKey(staticKeyLookup)(
        req,
        keySuffix,
        newGlobalSystemUser(getTwilioAccountSidFromHrmAccountId(req.hrmAccountId)),
      )
    )
      return next();
    return unauthorized(res);
  };
