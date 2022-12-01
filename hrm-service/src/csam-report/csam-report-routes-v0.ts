import createError from 'http-errors';
import { SafeRouter, publicEndpoint } from '../permissions';
import { acknowledgeCsamReport, createCSAMReport } from './csam-report';

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

csamReportRouter.post('/:reportId(\\d+)/acknowledge', publicEndpoint, async (req: Request & { accountSid: string }, res: Response) => {
  const { accountSid } = req;
  const reportId = parseInt(req.params.reportId, 10);

  const acknowledgedReport = await acknowledgeCsamReport(reportId, accountSid);

  if (!acknowledgedReport) {
    throw createError(404, `Report with id ${reportId} not found`);
  }

  res.json(acknowledgedReport);
});

export default csamReportRouter.expressRouter;
