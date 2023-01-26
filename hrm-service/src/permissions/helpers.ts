import { TwilioUser } from '@tech-matters/twilio-worker-auth';

export const isCounselorWhoCreated = (user: TwilioUser, caseObj: any) =>
  user.workerSid === caseObj.twilioWorkerId;

export const isCaseOpen = (caseObj: any) => caseObj.status !== 'closed';

export const isContactOwner = (user: TwilioUser, contactObj: any) =>
  user.workerSid === contactObj.twilioWorkerId;
