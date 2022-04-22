export { User } from './user';
export { SafeRouter, publicEndpoint } from './safe-router';
export { canEditCase, canViewPostSurvey } from './middlewares';
export { rulesMap } from './rulesMap';

import { setupCanForRules } from './setupCanForRules';
import { rulesMap } from './rulesMap';
// eslint-disable-next-line prettier/prettier
import type { Request, Response, NextFunction } from 'express';

const initializedCanMap = Object.entries(rulesMap).reduce<
  { [key in keyof typeof rulesMap]: ReturnType<typeof setupCanForRules> }
>((accum, [key, rules]) => {
  const can = setupCanForRules(rules);
  return {
    ...accum,
    [key]: can,
  };
}, null);

/**
 * Applies the permissions if valid.
 * @throws Will throw if initializedCan is not a function
 */
const applyPermissions = (
  req: Request,
  initializedCan: ReturnType<typeof setupCanForRules>,
  permissionsConfigName: string,
) => {
  if (!initializedCan) throw new Error(`Cannot find rules for ${permissionsConfigName}`);

  if (typeof initializedCan === 'string')
    throw new Error(`Error in rules for ${permissionsConfigName}. Error: ${initializedCan}`);

  if (typeof initializedCan !== 'function')
    throw new Error(`Error in rules for ${permissionsConfigName}. Error: can is not a function.`);

  //@ts-ignore TODO: Improve our custom Request type to override Express.Request
  req.can = initializedCan;
};

/**
 * @throws Will throw if there is no env var set for PERMISSIONS_${accountSid} or if it's an invalid key in rulesMap
 */
export const getPermissionsConfigName = (accountSid: string) => {
  const permissionsKey = `PERMISSIONS_${accountSid}`;

  const permissionsConfigName = process.env[permissionsKey];

  if (!permissionsConfigName)
    throw new Error(`No permissions set for account ${accountSid}.`);
    
  if (!rulesMap[permissionsConfigName])
    throw new Error(`Permissions rules with name ${permissionsConfigName} missing in rules map.`);

  return permissionsConfigName;
};

export const setupPermissions = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.USE_OPEN_PERMISSIONS) {
    applyPermissions(req, initializedCanMap.open, 'open rules');
    return next();
  }

  //@ts-ignore TODO: Improve our custom Request type to override Express.Request
  const { accountSid } = req;
  const permissionsKey = `PERMISSIONS_${accountSid}`;
  const permissionsConfigName = process.env[permissionsKey];
  const initializedCan = initializedCanMap[permissionsConfigName];

  applyPermissions(req, initializedCan, permissionsConfigName);
  return next();
};
