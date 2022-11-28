import { pgp } from '../../connection-pool';

export type NewCSAMReportRecord = {
  accountSid: string;
  createdAt: Date;
  updatedAt: Date;
  reportType: 'counsellor-generated' | 'self-generated';
  acknowledged: boolean;
  twilioWorkerId?: string;
  csamReportId?: string;
  contactId?: number;
};

export const insertCSAMReportSql = (report: NewCSAMReportRecord) => `
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
