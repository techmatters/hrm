import { publicEndpoint, SafeRouter } from '../permissions';
import { Request, Response } from 'express';
import { createReferral } from './referral';
import { DuplicateReferralError, OrphanedReferralError, Referral } from './referral-data-access';
import createError from 'http-errors';
import { isValid, parseISO } from 'date-fns';

const referralsRouter = SafeRouter();

referralsRouter.post(
  '/',
  publicEndpoint,
  async (req: Request<unknown, Referral, Referral>, res: Response) => {
    const { accountSid, body } = req;
    if (!body.resourceId || !body.contactId || !isValid(parseISO(body.referredAt))) {
      throw createError(400, 'Required referral property not present');
    }
    try {
      res.json(await createReferral(accountSid, body));
    } catch (err) {
      if (err instanceof DuplicateReferralError) {
        throw createError(400, err.message);
      }
      if (err instanceof OrphanedReferralError) {
        throw createError(404, err.message);
      }
      throw err;
    }
  },
);

export default referralsRouter.expressRouter;
