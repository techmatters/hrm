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

import { twilioUser, TwilioUser } from './twilioUser';
import { unauthorized } from '@tech-matters/http';
// eslint-disable-next-line prettier/prettier
import type { Request, Response, NextFunction } from 'express';

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
 * IMPORTANT: This kind of static key acces should never be used to retrieve sensitive information.
 */
const canAccessResourceWithStaticKey = (path: string, method: string): boolean => {
  return path.endsWith('/postSurveys') && method === 'POST';
};

type TokenValidatorResponse = { worker_sid: string; roles: string[] };

const isWorker = (tokenResult: TokenValidatorResponse) =>
  Boolean(tokenResult.worker_sid) && tokenResult.worker_sid.startsWith('WK');
const isGuest = (tokenResult: TokenValidatorResponse) =>
  Array.isArray(tokenResult.roles) && tokenResult.roles.includes('guest');

const defaultTokenLookup = (accountSid: string) => process.env[`TWILIO_AUTH_TOKEN_${accountSid}`] ?? '';

const authenticateWithStaticKey = (req: Request): boolean => {
  if (!req.headers) return false;
  const { headers: { authorization }, accountSid } = req;

  if (accountSid && authorization && authorization.startsWith('Basic')) {
    try {
      const staticSecretKey = `STATIC_KEY_${accountSid}`;
      const staticSecret = process.env[staticSecretKey];
      const requestSecret = authorization.replace('Basic ', '');

      const isStaticSecretValid =
        staticSecret &&
        requestSecret &&
        crypto.timingSafeEqual(Buffer.from(requestSecret), Buffer.from(staticSecret));

      if (isStaticSecretValid) {
        req.user = twilioUser(`account-${accountSid}`, []);
        return true;
      }
    } catch (err) {
      console.error('Static key authentication failed: ', err);
    }
  }
  return false;
};

export const getAuthorizationMiddleware = (authTokenLookup: (accountSid: string) => string = defaultTokenLookup) => async (req: Request, res: Response, next: NextFunction) => {
  if (!req || !req.headers || !req.headers.authorization) {
    return unauthorized(res);
  }

  const { authorization } = req.headers;
  const { accountSid } = req;
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
      req.user = twilioUser(tokenResult.worker_sid, tokenResult.roles);
      return next();
    } catch (err) {
      console.error('Token authentication failed: ', err);
    }
  }

  if (canAccessResourceWithStaticKey(req.path, req.method) && authenticateWithStaticKey(req)) return next();

  return unauthorized(res);
};

export const getStaticKeyAuthorizationMiddleware = () => async (req: Request, res: Response, next: NextFunction) => {
  if (canAccessResourceWithStaticKey(req.path, req.method) && authenticateWithStaticKey(req)) return next();
  return unauthorized(res);
};
