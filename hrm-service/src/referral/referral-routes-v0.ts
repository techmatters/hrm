import { publicEndpoint, SafeRouter } from '../permissions';
import { Request, Response } from 'express';
import { createReferral } from './referral';

const referralsRouter = SafeRouter();

referralsRouter.post('/', publicEndpoint, async (req: Request, res: Response) => {
  res.json(await createReferral());
});
