import { validator as TokenValidator } from 'twilio-flex-token-validator';
import crypto from 'crypto';

import { unauthorized } from '../utils';
import { User } from '../permissions';
// eslint-disable-next-line prettier/prettier
import type { Request, Response, NextFunction } from 'express';

/**
 * Helper to whitelist the requests that other parts of the system (external to HRM, like Serverless functions) can perform on HRM.
 * Takes in the path and the method of the request and returns a boolean indicating if the endpoint can be accessed.
 * @param {string} path
 * @param {string} method
 *
 * IMPORTANT: This kind of static key acces should never be used to retrieve sensitive information.
 */
const canAccessResourceWithStaticKey = (path: string, method: string): boolean => {
  return path === '/postSurveys' && method === 'POST';
};

type TokenValidatorResponse = { worker_sid: string; roles: string[] };

const isWorker = (tokenResult: TokenValidatorResponse) =>
  Boolean(tokenResult.worker_sid) && tokenResult.worker_sid.startsWith('WK');
const isGuest = (tokenResult: TokenValidatorResponse) =>
  Array.isArray(tokenResult.roles) && tokenResult.roles.includes('guest');

const defaultTokenLookup = (accountSid: string) => process.env[`TWILIO_AUTH_TOKEN_${accountSid}`];

export const getAuthorizationMiddleware = (authTokenLookup = defaultTokenLookup) => async (req: Request, res: Response, next: NextFunction) => {
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
      if (!authToken) throw new Error('authToken not provided for the specified accountSid.');

      const tokenResult = <TokenValidatorResponse>(
        await TokenValidator(token, accountSid, authToken)
      );

      if (!isWorker(tokenResult) || isGuest(tokenResult)) {
        return unauthorized(res);
      }

      req.user = new User(tokenResult.worker_sid, tokenResult.roles);
      return next();
    } catch (err) {
      console.error('Token authentication failed: ', err);
    }
  }

  if (authorization.startsWith('Basic')) {
    if (canAccessResourceWithStaticKey(req.path, req.method)) {
      try {
        const staticSecretKey = `STATIC_KEY_${accountSid}`;
        const staticSecret = process.env[staticSecretKey];
        const requestSecret = authorization.replace('Basic ', '');

        const isStaticSecretValid =
          staticSecret &&
          requestSecret &&
          crypto.timingSafeEqual(Buffer.from(requestSecret), Buffer.from(staticSecret));

        if (isStaticSecretValid) {
          req.user = new User(`account-${accountSid}`, []);
          return next();
        }
      } catch (err) {
        console.error('Static key authentication failed: ', err);
      }
    }
  }

  return unauthorized(res);
};
