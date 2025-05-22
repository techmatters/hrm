/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import createError from 'http-errors';
import { SafeRouter, publicEndpoint } from '../permissions';
import { acknowledgeCsamReport, createCSAMReport } from './csamReportService';

import type { Request, Response } from 'express';

const csamReportRouter = SafeRouter();

csamReportRouter.post(
  '/',
  publicEndpoint,
  async (req: Request & { hrmAccountId: string }, res: Response) => {
    const { hrmAccountId } = req;

    const { contactId, csamReportId, twilioWorkerId, reportType } = req.body;

    // Validate that the payload has a proper format
    if (
      reportType &&
      reportType !== 'counsellor-generated' &&
      reportType !== 'self-generated'
    ) {
      throw createError(422, 'Invalid argument "reportType" provided');
    }
    if ((!reportType || reportType === 'counsellor-generated') && !csamReportId) {
      throw createError(
        422,
        'Invalid, "reportType" argument specifies "counsellor-generated" report, but no csamReportId argument provided',
      );
    }

    const createdCSAMReport = await createCSAMReport(
      { contactId, csamReportId, twilioWorkerId, reportType },
      hrmAccountId,
    );
    res.json(createdCSAMReport);
  },
);

csamReportRouter.post(
  '/:reportId(\\d+)/acknowledge',
  publicEndpoint,
  async (req: Request & { hrmAccountId: string }, res: Response) => {
    const { hrmAccountId } = req;
    const reportId = parseInt(req.params.reportId, 10);

    const acknowledgedReport = await acknowledgeCsamReport(reportId, hrmAccountId);

    if (!acknowledgedReport) {
      throw createError(404, `Report with id ${reportId} not found`);
    }

    res.json(acknowledgedReport);
  },
);

export default csamReportRouter.expressRouter;
