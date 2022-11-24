import { randomUUID } from 'crypto';
import {
  // CSAMReportRecord,
  CreateCSAMReportRecord,
  updateContactIdByCsamReportIds,
  create,
  getById,
  getByContactId,
} from './csam-report-data-access';

export { CSAMReportRecord } from './csam-report-data-access';

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCSAMReport = getById;

export type CreateCSAMReport = Omit<CreateCSAMReportRecord, 'createdAt' | 'updatedAt'>;
export const createCSAMReport = async (
  body: Omit<CreateCSAMReportRecord, 'createdAt' | 'updatedAt'>,
  accountSid: string,
) => {
  const now = new Date();

  const { reportType, contactId, twilioWorkerId } = body;

  const csamReportId = reportType === 'self-generated' ? randomUUID() : body.csamReportId;

  // TODO: Should we check if the randomUUID exists in DB here?

  return create(
    {
      contactId: contactId || null,
      reportType,
      csamReportId,
      twilioWorkerId: twilioWorkerId || '',
      createdAt: now,
      updatedAt: now,
    },
    accountSid,
  );
};

// While this is being used in test only, chances are we'll use it when we move out to making separate calls to fetch different entities
export const getCsamReportsByContactId = getByContactId;

export const connectContactToCsamReports = updateContactIdByCsamReportIds;
