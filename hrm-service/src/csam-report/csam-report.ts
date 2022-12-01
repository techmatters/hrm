import { randomUUID } from 'crypto';
import {
  NewCSAMReport,
  updateContactIdByCsamReportIds,
  create,
  getById,
  getByContactId,
  updateAcknowledgedByCsamReportId,
} from './csam-report-data-access';

export { CSAMReport } from './csam-report-data-access';

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCSAMReport = getById;

export const createCSAMReport = async (
  body: Omit<NewCSAMReport, 'acknowledged'>,
  accountSid: string,
) => {
  const { reportType, contactId, twilioWorkerId } = body;

  const csamReportId = reportType === 'self-generated' ? randomUUID() : body.csamReportId;
  const acknowledged = reportType === 'self-generated' ? false : true;

  // TODO: Should we check if the randomUUID exists in DB here?

  return create(
    {
      contactId: contactId || null,
      reportType,
      csamReportId,
      twilioWorkerId: twilioWorkerId || '',
      acknowledged,
    },
    accountSid,
  );
};

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCsamReportsByContactId = getByContactId;

export const connectContactToCsamReports = updateContactIdByCsamReportIds;

export const acknowledgeCsamReport = updateAcknowledgedByCsamReportId(true);
