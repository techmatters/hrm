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
  CSAMReport,
  CSAMReportRecord,
} from './csamReportDataAccess';
import { HrmAccountId } from '@tech-matters/types';

export { CSAMReport } from './csamReportDataAccess';

const csamReportRecordToCsamReport = ({
  contactId,
  ...record
}: CSAMReportRecord): CSAMReport => ({
  ...record,
  ...(contactId ? { contactId: contactId.toString() } : {}),
});

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCSAMReport = async (
  reportId: string,
  accountSid: HrmAccountId,
): Promise<CSAMReport> => {
  const record = await getById(parseInt(reportId), accountSid);
  return csamReportRecordToCsamReport(record);
};

export const createCSAMReport = async (
  body: Omit<NewCSAMReport, 'acknowledged'>,
  accountSid: HrmAccountId,
): Promise<CSAMReport> => {
  const { reportType, twilioWorkerId, contactId: inputContactId } = body;

  const acknowledged = reportType !== 'self-generated';
  const csamReportId = acknowledged ? body.csamReportId : randomUUID();

  // TODO: Should we check if the randomUUID exists in DB here?

  const record = await create(
    {
      contactId: inputContactId || null,
      reportType,
      csamReportId,
      twilioWorkerId: twilioWorkerId || null,
      acknowledged,
    },
    accountSid,
  );
  return csamReportRecordToCsamReport(record);
};

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCsamReportsByContactId = async (
  contactId: string,
  accountSid: HrmAccountId,
) => {
  const records = await getByContactId(parseInt(contactId), accountSid);
  return records.map(csamReportRecordToCsamReport);
};

export const acknowledgeCsamReport = updateAcknowledgedByCsamReportId(true);
