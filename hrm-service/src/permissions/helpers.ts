import { User } from '@tech-matters/twilio-worker-auth';

export const isCounselorWhoCreated = (user: User, caseObj: any) =>
  user.workerSid === caseObj.twilioWorkerId;

export const isCaseOpen = (caseObj: any) => caseObj.status !== 'closed';

export const isContactOwner = (user: User, contactObj: any) =>
  user.workerSid === contactObj.twilioWorkerId;
