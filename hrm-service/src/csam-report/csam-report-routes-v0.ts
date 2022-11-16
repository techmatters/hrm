import { SafeRouter, publicEndpoint } from '../permissions';
import { createCSAMReport } from './csam-report';

// eslint-disable-next-line prettier/prettier
import type { Request, Response } from 'express';

const csamReportRouter = SafeRouter();

csamReportRouter.post('/', publicEndpoint, async (req: Request & { accountSid: string }, res: Response) => {
  const { accountSid } = req;

  const { contactId, csamReportId, twilioWorkerId } = req.body;

  const createdCSAMReport = await createCSAMReport({ contactId, csamReportId, twilioWorkerId }, accountSid);
  res.json(createdCSAMReport);
});

export default csamReportRouter.expressRouter;
