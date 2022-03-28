import { CaseRecord, NewCaseRecord } from '../../src/case/case-data-access';


const workerSid = 'worker-sid';
const baselineDate = new Date(2000, 5, 1);

export const createMockCaseRecord = (partial: Partial<CaseRecord>): CaseRecord => {
  return Object.assign({
    id: 1,
    helpline: 'helpline',
    status: 'open',
    info: {
      counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
    },
    twilioWorkerId: 'twilio-worker-id',
    createdBy: workerSid,
    accountSid: 'ACCOUNT_SID',
    createdAt: baselineDate.toISOString(),
    updatedAt: baselineDate.toISOString(),
  }, partial);
};

export const createMockCaseInsert = (partial: Partial<NewCaseRecord>): Partial<NewCaseRecord> => {
  return Object.assign({
    helpline: 'helpline',
    status: 'open',
    info: {
      counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
    },
    twilioWorkerId: 'twilio-worker-id',
    createdBy: workerSid,
    accountSid: 'ACCOUNT_SID',
  }, partial);
};