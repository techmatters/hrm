import { CaseRecord, NewCaseRecord } from '../../src/case/case-data-access';
import { Case } from '../../src/case/case';

const workerSid = 'worker-sid';
const baselineDate = new Date(2000, 5, 1);

export const createMockCaseRecord = (partial: Partial<CaseRecord>): CaseRecord => {
  return Object.assign(
    <CaseRecord>{
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
      updatedBy: null,
      caseSections: [
        {
          caseId: 1,
          sectionType: 'note',
          sectionId: 'NOTE_1',
          createdBy: 'contact-adder',
          createdAt: baselineDate.toISOString(),
          sectionTypeSpecificData: { note: 'Child with covid-19' },
        },
      ],
    },
    partial,
  );
};

export const createMockCaseInsert = (partial: Partial<NewCaseRecord>): NewCaseRecord => {
  return Object.assign(
    {
      ...createMockCaseRecord({}),
      caseSections: [
        {
          sectionType: 'note',
          sectionId: 'NOTE_1',
          createdBy: 'contact-adder',
          createdAt: baselineDate.toISOString(),
          updatedAt: undefined,
          updatedBy: undefined,
          sectionTypeSpecificData: { note: 'Child with covid-19' },
        },
      ],
    },
    partial,
  );
};

export const createMockCase = (partial: Partial<Case>): Case => {
  const record = createMockCaseRecord({});
  delete record.caseSections;
  return Object.assign(
    {
      ...record,
      childName: '',
      categories: {},
    },
    partial,
  );
};
