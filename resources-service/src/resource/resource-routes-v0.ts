import { IRouter, Router } from 'express';
import { getResource } from './resource-model';
import { AccountSID } from '@tech-matters/twilio-worker-auth';
import createError from 'http-errors';

const router: IRouter = Router();

router.get('/resource/:resourceId', async (req, res) => {
  const referrableResource = await getResource(<AccountSID>req.accountSid, req.params.resourceId);
  if (!referrableResource) {
    throw createError(404);
  }
  res.json(referrableResource);
});

export default router;
