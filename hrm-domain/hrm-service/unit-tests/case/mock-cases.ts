/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { CaseRecord, NewCaseRecord } from '../../src/case/case-data-access';
import { CaseService } from '../../src/case/caseService';
import { workerSid } from '../../service-tests/mocks';

const baselineDate = new Date(2000, 5, 1);

export const createMockCaseRecord = (partial: Partial<CaseRecord>): CaseRecord => {
  return Object.assign(
    <CaseRecord>{
      id: 1,
      helpline: 'helpline',
      status: 'open',
      info: {
        counsellorNotes: [
          { note: 'Child with covid-19', twilioWorkerId: 'contact-adder' },
        ],
      },
      twilioWorkerId: 'twilio-worker-id',
      createdBy: workerSid,
      accountSid: 'ACCOUNT_SID',
      createdAt: baselineDate.toISOString(),
      updatedAt: baselineDate.toISOString(),
      updatedBy: null,
      caseSections: [
        {
          accountSid: 'ACCOUNT_SID',
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

export const createMockCase = (partial: Partial<CaseService>): CaseService => {
  const record = createMockCaseRecord({});
  delete record.caseSections;
  return Object.assign(
    {
      ...record,
      categories: {},
    },
    partial,
  );
};
