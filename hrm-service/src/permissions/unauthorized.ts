import { Response } from 'express';

export const unauthorized = (res: Response) => {
  const authorizationFailed = { error: 'Authorization failed' };
  console.log(`[authorizationMiddleware]: ${JSON.stringify(authorizationFailed)}`);
  res.status(401).json(authorizationFailed);
  return authorizationFailed;
};
