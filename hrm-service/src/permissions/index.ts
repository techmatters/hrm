import { SafeRouterRequest } from './safe-router';

export { SafeRouter, publicEndpoint } from './safe-router';
export { rulesMap } from './rulesMap';
export { Actions, actionsMaps, getActions } from './actions';

import { setupCanForRules } from './setupCanForRules';
import { RulesFile } from './rulesMap';
// eslint-disable-next-line prettier/prettier
import type { Request, Response, NextFunction } from 'express';

const canCache: Record<string, ReturnType<typeof setupCanForRules>> = {};

export type Permissions = {
  rules: (accountSid: string) => RulesFile;
  cachePermissions: boolean;
};

/**
 * Applies the permissions if valid.
 * @throws Will throw if initializedCan is not a function
 */
export const applyPermissions = (req: Request,
  initializedCan: ReturnType<typeof setupCanForRules>,
  ) => {
  if (typeof initializedCan !== 'function')
    throw new Error(`Error in looked up permission rules: can is not a function.`);

  //@ts-ignore TODO: Improve our custom Request type to override Express.Request
  req.can = initializedCan;
};

export const setupPermissions = (lookup: Permissions) => (req: Request, res: Response, next: NextFunction) => {
  const { accountSid } = <any>req;
  if (lookup.cachePermissions) {
    canCache[accountSid] = canCache[accountSid] ?? setupCanForRules(lookup.rules(accountSid));
    const initializedCan = canCache[accountSid];
    applyPermissions(req, initializedCan);
  } else {
    applyPermissions(req, setupCanForRules(lookup.rules(accountSid)));
  }
  return next();
};

export type RequestWithPermissions = SafeRouterRequest & {
  can: ReturnType<typeof setupCanForRules>
};