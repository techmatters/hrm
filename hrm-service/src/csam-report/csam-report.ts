import {
  // CSAMReportRecord,
  CreateCSAMReport,
  updateContactIdByCsamReportIds,
  create,
  getById,
  getByContactId,
} from './csam-report-data-access';

export { CSAMReportRecord } from './csam-report-data-access';

export const getCSAMReport = getById;

export const createCSAMReport = async (
  body: Omit<CreateCSAMReport, 'createdAt' | 'updatedAt'>,
  accountSid: string,
) => {
  const now = new Date();

  return create(
    {
      contactId: body.contactId || null,
      csamReportId: body.csamReportId || '',
      twilioWorkerId: body.twilioWorkerId || '',
      createdAt: now,
      updatedAt: now,
    },
    accountSid,
  );
};

export const getCsamReportsByContactId = getByContactId;

export const connectContactToCsamReports = updateContactIdByCsamReportIds;
