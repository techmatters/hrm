import createError from 'http-errors';
import { SafeRouter, publicEndpoint } from '../permissions';
import { rulesMap, getPermissionsConfigName } from '../permissions';
// eslint-disable-next-line prettier/prettier
import type { Request, Response } from 'express';

const permissionsRouter = SafeRouter();

permissionsRouter.get('/', publicEndpoint, (req: Request, res: Response) => {
  //@ts-ignore TODO: Improve our custom Request type to override Express.Request
  const { accountSid } = req;

  const permissionsConfigName = getPermissionsConfigName(accountSid);

  if (!permissionsConfigName)
    throw createError(500, `No permissions set for account ${accountSid}.`);
    
  if (!rulesMap[permissionsConfigName])
    throw createError(500, `Permissions rules with name ${permissionsConfigName} missing in rules map.`);

  const rules = rulesMap[permissionsConfigName];

  res.json(rules);
});

export default permissionsRouter.expressRouter;
