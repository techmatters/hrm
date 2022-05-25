import { exportTranscript } from './exportTranscript';
import { getColumnsForTranscript } from '../contact/contact';

export const exportTranscriptsInRange = async ({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string;
  dateTo?: string;
}) => {
  const toBeExported = await getColumnsForTranscript({ dateFrom, dateTo });

  console.log('toBeExported:', toBeExported);
  toBeExported.forEach(async ({ accountSid, serviceSid, channelSid }) => {
    await exportTranscript(accountSid, serviceSid, channelSid);
  });
};
