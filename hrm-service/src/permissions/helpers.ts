import { User } from './index';

export const isSupervisor = (user: User) => user.roles.includes('supervisor');

export const isCounselorWhoCreated = (user: User, caseObj: any) =>
  user.workerSid === caseObj.dataValues.twilioWorkerId;

export const isCaseOpen = (caseObj: any) => caseObj.dataValues.status !== 'closed';
