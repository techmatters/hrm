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

import { CaseRecord, NewCaseRecord } from '../../case/caseDataAccess';
import { CaseService } from '../../case/caseService';
import { workerSid } from '../mocks';

const baselineDate = new Date(2000, 5, 1);

export const createMockCaseRecord = (partial: Partial<CaseRecord>): CaseRecord => {
  return Object.assign(
    <CaseRecord>{
      label: 'case1 label',
      id: 1,
      helpline: 'helpline',
      status: 'open',
      info: {},
      twilioWorkerId: 'WK-twilio-worker-id',
      createdBy: workerSid,
      accountSid: 'ACCOUNT_SID',
      createdAt: baselineDate.toISOString(),
      updatedAt: baselineDate.toISOString(),
      updatedBy: null,
      statusUpdatedAt: null,
      statusUpdatedBy: null,
      caseSections: [
        {
          accountSid: 'ACCOUNT_SID',
          caseId: 1,
          sectionType: 'note',
          sectionId: 'NOTE_1',
          createdBy: 'WK-contact-adder',
          createdAt: baselineDate.toISOString(),
          eventTimestamp: baselineDate.toISOString(),
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
    },
    partial,
  );
};

export const createMockCase = (partial: Partial<CaseService>): CaseService => {
  return Object.assign(createMockCaseRecord({}), partial);
};
