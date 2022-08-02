export { User } from './user';
export { SafeRouter, publicEndpoint } from './safe-router';
export { rulesMap } from './rulesMap';
export { Actions, actionsMaps, getActions } from './actions';

import { setupCanForRules } from './setupCanForRules';
import { RulesFile } from './rulesMap';
// eslint-disable-next-line prettier/prettier
import type { Request, Response, NextFunction } from 'express';

export type Permissions = {
  checker: (accountSid: string) => ReturnType<typeof setupCanForRules>;
  rules?: (accountSid: string) => RulesFile;
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
  const initializedCan = lookup.checker(accountSid);

  applyPermissions(req, initializedCan);
  return next();
};
