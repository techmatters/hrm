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

import { randomUUID } from 'crypto';
import {
  NewCSAMReport,
  create,
  getById,
  getByContactId,
  updateAcknowledgedByCsamReportId,
} from './csam-report-data-access';
import { HrmAccountId } from '@tech-matters/types';

export { CSAMReport } from './csam-report-data-access';

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCSAMReport = getById;

export const createCSAMReport = async (
  body: Omit<NewCSAMReport, 'acknowledged'>,
  accountSid: HrmAccountId,
) => {
  const { reportType, contactId, twilioWorkerId } = body;

  const acknowledged = reportType !== 'self-generated';
  const csamReportId = acknowledged ? body.csamReportId : randomUUID();

  // TODO: Should we check if the randomUUID exists in DB here?

  return create(
    {
      contactId: contactId || null,
      reportType,
      csamReportId,
      twilioWorkerId: twilioWorkerId || null,
      acknowledged,
    },
    accountSid,
  );
};

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCsamReportsByContactId = getByContactId;

export const acknowledgeCsamReport = updateAcknowledgedByCsamReportId(true);
