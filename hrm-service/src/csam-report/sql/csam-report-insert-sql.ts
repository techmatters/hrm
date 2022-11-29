import { pgp } from '../../connection-pool';
import { NewCSAMReport } from '../csam-report-data-access';

export const insertCSAMReportSql = (
  report: NewCSAMReport & { accountSid: string; createdAt: Date; updatedAt: Date },
) => `
  ${pgp.helpers.insert(
    report,
    [
      'accountSid',
      'createdAt',
      'updatedAt',
      'twilioWorkerId',
      'csamReportId',
      'contactId',
      'reportType',
      'acknowledged',
    ],
    'CSAMReports',
  )}
  RETURNING *
`;
