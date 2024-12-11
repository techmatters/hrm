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

import { validator as TokenValidator } from 'twilio-flex-token-validator';
import crypto from 'crypto';

import { newTwilioUser, TwilioUser } from './twilioUser';
import { unauthorized } from '@tech-matters/http';
import type { Request, Response, NextFunction } from 'express';
import { AccountSID, TwilioUserIdentifier, WorkerSID } from '@tech-matters/types';

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
  if (
    (process.env.TASK_ROUTER_CONTACT_CREATION || '').toLowerCase() === 'true' &&
    path.endsWith('/contacts') &&
    method === 'POST'
  )
    return true;

  // If the requests is retrieve the list of flags associated to a given identifier, grant access
  if (/\/profiles\/identifier\/[^/]+\/flags$/.test(path) && method === 'GET') return true;

  return false;
};

type TokenValidatorResponse = { worker_sid: string; roles: string[] };

const isWorker = (tokenResult: TokenValidatorResponse) =>
  Boolean(tokenResult.worker_sid) && tokenResult.worker_sid.startsWith('WK');
const isGuest = (tokenResult: TokenValidatorResponse) =>
  Array.isArray(tokenResult.roles) && tokenResult.roles.includes('guest');

const defaultTokenLookup = (accountSid: string) =>
  process.env[`TWILIO_AUTH_TOKEN_${accountSid}`] ?? '';

const extractAccountSid = (request: Request): AccountSID => {
  const [twilioAccountSid] = request.params.accountSid?.split('-') ?? [];
  return twilioAccountSid as AccountSID;
};

const authenticateWithStaticKey = (
  req: Request,
  keySuffix: string,
  userId?: TwilioUserIdentifier,
): boolean => {
  if (!req.headers) return false;
  const {
    headers: { authorization },
  } = req;

  if (keySuffix && authorization && authorization.startsWith('Basic')) {
    try {
      const staticSecretKey = `STATIC_KEY_${keySuffix}`;
      const staticSecret = process.env[staticSecretKey];
      const requestSecret = authorization.replace('Basic ', '');

      const isStaticSecretValid =
        staticSecret &&
        requestSecret &&
        crypto.timingSafeEqual(Buffer.from(requestSecret), Buffer.from(staticSecret));

      if (isStaticSecretValid) {
        req.user = newTwilioUser(extractAccountSid(req), userId, []);
        return true;
      }
    } catch (err) {
      console.warn('Static key authentication failed: ', err);
    }
  }
  return false;
};

export const getAuthorizationMiddleware =
  (authTokenLookup: (accountSid: AccountSID) => string = defaultTokenLookup) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req || !req.headers || !req.headers.authorization) {
      return unauthorized(res);
    }

    const { authorization } = req.headers;
    const accountSid = extractAccountSid(req);
    if (!accountSid) return unauthorized(res);

    if (authorization.startsWith('Bearer')) {
      const token = authorization.replace('Bearer ', '');
      try {
        const authToken = authTokenLookup(accountSid);
        if (!authToken) {
          console.error(`authToken not provided for the accountSid ${accountSid}.`);
          return unauthorized(res);
        }

        const tokenResult = <TokenValidatorResponse>(
          await TokenValidator(token, accountSid, authToken)
        );
        if (!isWorker(tokenResult) || isGuest(tokenResult)) {
          return unauthorized(res);
        }
        req.user = newTwilioUser(
          accountSid,
          tokenResult.worker_sid as WorkerSID,
          tokenResult.roles,
        );
        return next();
      } catch (err) {
        console.error('Token authentication failed: ', err);
      }
    }

    if (
      canAccessResourceWithStaticKey(req.originalUrl, req.method) &&
      authenticateWithStaticKey(req, accountSid, `account-${accountSid}`)
    )
      return next();

    return unauthorized(res);
  };

export const staticKeyAuthorizationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const accountSid = extractAccountSid(req);
  if (!accountSid) {
    throw new Error(
      'staticKeyAuthorizationMiddleware invoked with invalid request, req.accountSid missing',
    );
  }

  if (authenticateWithStaticKey(req, accountSid, `account-${accountSid}`)) return next();
  return unauthorized(res);
};

// TODO: do we want to differentiate what is actually system vs admin?
export const systemUser = 'system';
export const adminAuthorizationMiddleware =
  (keySuffix: string) => async (req: Request, res: Response, next: NextFunction) => {
    if (authenticateWithStaticKey(req, keySuffix, systemUser)) return next();
    return unauthorized(res);
  };
