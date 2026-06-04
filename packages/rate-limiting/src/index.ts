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

import type { Request, Response, NextFunction } from 'express';
import { getTwilioAccountSidFromHrmAccountId, AccountSID } from '@tech-matters/types';

const MAX_TOKENS = 1000;
const REFRESH_TOKENS_INTERVAL = 1000 * 60;

const tokensMap: Map<AccountSID, number> = new Map();

let initialized = false;
let intervalId: NodeJS.Timeout;

const refreshTokens = () => {
  for (let [accountSid] of tokensMap) {
    tokensMap.set(accountSid, MAX_TOKENS);
  }
};

const initialize = () => {
  if (initialized) return;

  initialized = true;

  intervalId = setInterval(refreshTokens, REFRESH_TOKENS_INTERVAL);
};

// TODO
const cleanup = () => {
  clearInterval(intervalId);
};

const hasQuota = (accountSid: AccountSID) => {
  if (!tokensMap.has(accountSid)) {
    tokensMap.set(accountSid, MAX_TOKENS);
  }

  tokensMap.set(accountSid, tokensMap.get(accountSid)! - 1);

  console.log('>>>> ', tokensMap.get(accountSid));

  return tokensMap.get(accountSid)! > 0;
};

const checkQuotaMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const accountSid = getTwilioAccountSidFromHrmAccountId((req as any).hrmAccountId);

  if (!hasQuota(accountSid!)) {
    const error = { error: 'Too many requests' };
    console.log(`[checkQuotaMiddleware]: ${accountSid} has depleted the token bucket`);
    res.status(429).json(error);
    return error;
  }

  return next();
};

export const getCheckQuotaMiddleware = () => {
  initialize();

  return checkQuotaMiddleware;
};
