/**
 * This file extends the default Express.Request interface with extra stuff that we bundle in the requests
 */

import { User } from '@tech-matters/twilio-worker-auth';

// to make the file a module and avoid the TypeScript error
// export {};

declare global {
  namespace Express {
    export interface Request {
      accountSid?: string;
      user?: User;
    }
  }
}
