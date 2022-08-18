import { SafeRouter, publicEndpoint, Permissions } from '../permissions';
// eslint-disable-next-line prettier/prettier
import type { Request, Response } from 'express';
import createError from 'http-errors';

export default (permissions: Permissions) => {
  const permissionsRouter = SafeRouter();
  permissionsRouter.get('/', publicEndpoint, (req: Request, res: Response, next) => {
    try {
      //@ts-ignore TODO: Improve our custom Request type to override Express.Request
      const { accountSid } = req;
      if (!permissions.rules) {
        return next(createError(400, 'Reading rules is not supported by the permissions implementation being used by this instance of the HRM service.'));
      }
      const rules = permissions.rules(accountSid);

      res.json(rules);
    } catch (err) {
      return next(createError(500, err.message));
    }
  });

  return permissionsRouter.expressRouter;
};
