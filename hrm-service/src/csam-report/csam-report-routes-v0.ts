import createError from 'http-errors';
import { SafeRouter, publicEndpoint } from '../permissions';
import { aknowledgeCsamReport, createCSAMReport, deleteCsamReport } from './csam-report';

// eslint-disable-next-line prettier/prettier
import type { Request, Response } from 'express';

const csamReportRouter = SafeRouter();

csamReportRouter.post('/', publicEndpoint, async (req: Request & { accountSid: string }, res: Response) => {
  const { accountSid } = req;

  const { contactId, csamReportId, twilioWorkerId, reportType } = req.body;

  // Validate that the payload has a proper format
  if (reportType && reportType !== "counsellor-generated" && reportType !== "self-generated") {
    throw createError(422, 'Invalid argument "reportType" provided'); 
  }
  if ((!reportType || reportType === "counsellor-generated") && !csamReportId) {
    throw createError(422, 'Invalid, "reportType" argument specifies "counsellor-generated" report, but no csamReportId argument provided'); 
  }

  const createdCSAMReport = await createCSAMReport({ contactId, csamReportId, twilioWorkerId, reportType }, accountSid);
  res.json(createdCSAMReport);
});

csamReportRouter.delete('/:reportId', publicEndpoint, async (req: Request & { accountSid: string }, res: Response) => {
  const { accountSid } = req;
  const reportId = parseInt(req.params.reportId, 10);

  if (isNaN(reportId)) {
    throw createError(422, 'Invalid id');
  }

  await deleteCsamReport(reportId, accountSid);

  res.json({ message: `CSAMReport with id ${reportId} deleted` });
});

csamReportRouter.post('/:reportId/aknowledge', publicEndpoint, async (req: Request & { accountSid: string }, res: Response) => {
  const { accountSid } = req;
  const reportId = parseInt(req.params.reportId, 10);

  if (isNaN(reportId)) {
    throw createError(422, 'Invalid id');
  }

  const aknowledgedReport = await aknowledgeCsamReport(reportId, accountSid);

  if (!aknowledgedReport) {
    throw createError(404, `Report with id ${reportId} not found`);
  }

  res.json(aknowledgedReport);
});

export default csamReportRouter.expressRouter;
