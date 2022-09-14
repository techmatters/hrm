// eslint-disable-next-line prettier/prettier
import type  { Request, Response, NextFunction } from "express";

/**
 * Middleware that adds the account sid (taken from path) to the request object, so we can use it in the routes.
 * NOTE: If we ever move this project to Typescript: https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5
 */
export const addAccountSid = (req: Request, res: Response, next: NextFunction) => {
  req.accountSid = req.params.accountSid;
  return next();
};