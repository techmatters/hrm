import { pgp } from '../../connection-pool';

export type NewCSAMReportRecord = {
  accountSid: string;
  createdAt: Date;
  updatedAt: Date;
  twilioWorkerId?: string;
  csamReportId?: string;
  contactId?: number;
};

export const insertCSAMReportSql = (report: NewCSAMReportRecord) => `
  ${pgp.helpers.insert(
    report,
    ['accountSid', 'createdAt', 'updatedAt', 'twilioWorkerId', 'csamReportId', 'contactId'],
    'CSAMReports',
  )}
  RETURNING *
`;
