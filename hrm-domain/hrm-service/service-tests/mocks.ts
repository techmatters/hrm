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

import { CaseService, getCase } from '@tech-matters/hrm-core/case/caseService';
import {
  NewConversationMedia,
  S3ContactMediaType,
} from '@tech-matters/hrm-core/conversation-media/conversationMedia';
import { Contact } from '@tech-matters/hrm-core/contact/contactDataAccess';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import { NewCaseSection } from '@tech-matters/hrm-core/case/caseSection/types';
import { createCaseSection } from '@tech-matters/hrm-core/case/caseSection/caseSectionService';
import type { AccountSID } from '@tech-matters/types';
import { openRules } from '@tech-matters/hrm-core/permissions/jsonPermissions';

export const accountSid = 'ACCOUNT_SID';

export const contact1: NewContactRecord = {
  rawJson: {
    callType: 'Child calling about self',
    childInformation: {
      firstName: 'Jhonny',
      lastName: 'Theboy qwerty',
      gender: '',
      age: '',
      language: '',
      nationality: '',
      ethnicity: '',
      streetAddress: '',
      city: '',
      stateOrCounty: '',
      postalCode: '',
      phone1: '',
      phone2: '',
      refugee: false,
    },
    caseInformation: {
      callSummary: '',
      referredTo: '',
      status: '',
      keepConfidential: false,
      okForCaseWorkerToCall: false,
      howDidTheChildHearAboutUs: '',
      didYouDiscussRightsWithTheChild: false,
      didTheChildFeelWeSolvedTheirProblem: false,
      wouldTheChildRecommendUsToAFriend: false,
    },
    categories: {},
    callerInformation: {
      firstName: '',
      lastName: '',
      relationshipToChild: '',
      gender: '',
      age: '',
      language: '',
      nationality: '',
      ethnicity: '',
      city: '',
      phone1: '',
      phone2: '',
      postalCode: '',
      stateOrCounty: '',
      streetAddress: '',
    },
  },
  taskId: 'contact1-task-sid',
  twilioWorkerId: 'WK-worker-sid',
  createdBy: 'WK-worker-sid',
  helpline: '',
  queueName: '',
  number: '12025550184',
  channel: 'chat',
  conversationDuration: 14,
  profileId: undefined,
  identifierId: undefined,
  definitionVersion: 'as-v1',
};

export const contact2: NewContactRecord = {
  rawJson: {
    callType: 'Someone calling about a child',
    childInformation: {
      firstName: 'Name',
      lastName: 'Random',
      gender: '',
      age: '',
      language: '',
      nationality: '',
      ethnicity: '',
      streetAddress: '',
      city: '',
      stateOrCounty: '',
      postalCode: '',
      phone1: '',
      phone2: '',
      refugee: false,
    },
    caseInformation: {
      callSummary: '',
      referredTo: '',
      status: '',
      keepConfidential: false,
      okForCaseWorkerToCall: false,
      howDidTheChildHearAboutUs: '',
      didYouDiscussRightsWithTheChild: false,
      didTheChildFeelWeSolvedTheirProblem: false,
      wouldTheChildRecommendUsToAFriend: false,
    },
    categories: {},
    callerInformation: {
      firstName: 'Jhon qwerty',
      lastName: 'Thecaller',
      relationshipToChild: '',
      gender: '',
      age: '',
      language: '',
      nationality: '',
      ethnicity: '',
      city: '',
      phone1: '',
      phone2: '',
      postalCode: '',
      stateOrCounty: '',
      streetAddress: '',
    },
  },
  twilioWorkerId: 'WK-worker-sid',
  taskId: 'contact2-task-sid',
  createdBy: 'WK-worker-sid',
  helpline: '',
  queueName: '',
  number: '12025550184',
  channel: 'chat',
  conversationDuration: 10,
  profileId: undefined,
  identifierId: undefined,
  definitionVersion: 'as-v1',
};

export const nonData1: NewContactRecord = {
  ...contact1,
  taskId: 'nonData1-task-sid',
  rawJson: {
    callType: 'Joke',
    childInformation: {},
    caseInformation: { callSummary: '' },
    categories: {},
    callerInformation: {},
  },
};
export const nonData2: NewContactRecord = {
  ...contact2,
  taskId: 'nonData2-task-sid',
  rawJson: {
    callType: 'Blank',
    childInformation: {},
    caseInformation: { callSummary: '' },
    callerInformation: {},
    categories: {},
  },
};
// Non data contacts with actual information
export const broken1: NewContactRecord = {
  ...contact1,
  taskId: 'broken1-task-sid',
  rawJson: { ...contact1.rawJson, callType: 'Joke' },
};
export const broken2: NewContactRecord = {
  ...contact2,
  taskId: 'broken2-task-sid',
  rawJson: { ...contact2.rawJson, callType: 'Blank' },
};

export const anotherChild: Contact['rawJson']['childInformation'] = {
  ...contact1.rawJson.childInformation,
  firstName: 'Marie',
  lastName: 'Curie',
};

export const anotherCaller: ContactRawJson['callerInformation'] = {
  ...contact2.rawJson.callerInformation,
  firstName: 'Marie',
  lastName: 'Curie',
};

export const another1: NewContactRecord = {
  ...contact1,
  taskId: 'another1-task-sid',
  rawJson: { ...contact1.rawJson, childInformation: anotherChild },
  helpline: 'Helpline 1',
};

export const another2: NewContactRecord = {
  ...contact2,
  taskId: 'another2-task-sid',
  rawJson: {
    ...contact2.rawJson,
    callerInformation: {
      ...anotherCaller,
      phone1: '+1 (515) 555-1212',
      phone2: '+1 (616) 555-1212',
    },
    childInformation: {
      ...anotherChild,
      phone1: '(313) 555-1212',
      phone2: '+1 (414) 555-1212',
    },
  },
  helpline: 'Helpline 2',
  number: '+12125551212',
};

export const noHelpline: NewContactRecord = {
  ...another1,
  taskId: 'noHelpline-task-sid',
  helpline: '',
};

export const withTaskId: NewContactRecord = {
  rawJson: {
    callType: 'Child calling about self',
    childInformation: {
      firstName: 'withTaskId',
      lastName: 'withTaskId',
      gender: '',
      age: '',
      language: '',
      nationality: '',
      ethnicity: '',
      streetAddress: '',
      city: '',
      stateOrCounty: '',
      postalCode: '',
      phone1: '',
      phone2: '',
      refugee: false,
    },
    categories: contact1.rawJson.categories,
    callerInformation: contact1.rawJson.callerInformation,
    caseInformation: contact1.rawJson.caseInformation,
  },
  twilioWorkerId: 'WK-worker-sid',
  createdBy: 'WK-worker-sid',
  helpline: 'withTaskId',
  queueName: '',
  number: '11111111111',
  channel: 'chat',
  conversationDuration: 1,
  taskId: 'taskId',
  profileId: undefined,
  identifierId: undefined,
  definitionVersion: 'as-v1',
};
export type CaseSectionInsert = {
  section: NewCaseSection;
  workerSid: CaseService['twilioWorkerId'];
};

export const workerSid = 'WK-worker-sid';

export const ALWAYS_CAN = {
  user: newTwilioUser(accountSid, workerSid, []),
  can: () => true,
  permissionRules: openRules,
  permissionCheckContact: undefined,
};

export const populateCaseSections = async (
  caseId: string,
  sectionsMap: Record<string, CaseSectionInsert[]>,
  caseAccountSid: AccountSID = accountSid,
): Promise<CaseService> => {
  const sectionsEntries = Object.entries(sectionsMap);
  for (const [sectionType, sections] of sectionsEntries) {
    for (const { section, workerSid: sectionWorkerSid } of sections) {
      await createCaseSection(
        caseAccountSid,
        caseId,
        sectionType,
        section,
        sectionWorkerSid,
        true,
      );
      // Ensure timestamps are in creation order & there are no collisions
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  return getCase(caseId, caseAccountSid, ALWAYS_CAN);
};

export const case1: Partial<CaseService> = {
  status: 'open',
  helpline: 'helpline',
  info: {
    operatingArea: 'East',
  },
  twilioWorkerId: 'WK-worker-sid',
  createdBy: 'WK-worker-sid',
  accountSid,
  definitionVersion: 'as-v1',
} as const;

export const case2: Partial<CaseService> = {
  status: 'open',
  helpline: 'helpline',
  info: {
    operatingArea: 'West',
    followUpDate: '2022-01-15T00:00:00.000Z',
  },
  twilioWorkerId: 'WK-worker-sid',
  createdBy: 'WK-worker-sid',
  accountSid,
  definitionVersion: 'as-v1',
};

export const case3 = {
  ...case1,
  info: {
    summary: 'something summery',
    followUpDate: '2005-03-15T00:00:00.000Z',
    operatingArea: 'North',
  },
};

export const casePopulated = {
  ...case1,
  info: {
    summary: 'something summery',
    followUpDate: '2005-03-15T00:00:00.000Z',
  },
};

export const populatedCaseSections: Record<string, CaseSectionInsert[]> = {
  note: [
    {
      workerSid: 'WK-note-adder',
      section: {
        sectionId: '1',
        sectionTypeSpecificData: {
          note: 'Child with covid-19',
        },
      },
    },
    {
      workerSid: 'WK-other-note-adder',
      section: {
        sectionId: '2',
        sectionTypeSpecificData: {
          note: 'Child recovered from covid-19',
        },
      },
    },
  ],
  perpetrator: [
    {
      workerSid: 'WK-perpetrator-adder',
      section: {
        sectionTypeSpecificData: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      },
    },
    {
      workerSid: 'WK-perpetrator-adder',
      section: {
        sectionTypeSpecificData: {
          firstName: 'J.',
          lastName: 'Doe',
          phone2: '+12345678',
        },
      },
    },
  ],
  household: [
    {
      workerSid: 'WK-household-adder',
      section: {
        sectionTypeSpecificData: {
          firstName: 'Jane',
          lastName: 'Doe',
        },
      },
    },
    {
      workerSid: 'WK-household-adder',
      section: {
        sectionTypeSpecificData: {
          firstName: 'J.',
          lastName: 'Doe',
          phone2: '+12345678',
        },
      },
    },
  ],
  incident: [
    {
      workerSid: 'WK-incident-adder',
      section: {
        sectionTypeSpecificData: {
          date: '2021-03-03',
          duration: '',
          location: 'Other',
          isCaregiverAware: null,
          incidentWitnessed: null,
          reactionOfCaregiver: '',
          whereElseBeenReported: '',
          abuseReportedElsewhere: null,
        },
      },
    },
  ],
  referral: [
    {
      workerSid: 'WK-referral-adder',
      section: {
        sectionId: '2503',
        sectionTypeSpecificData: {
          date: '2021-02-18',
          comments: 'Referred to state agency',
          referredTo: 'DREAMS',
        },
      },
    },
  ],
  document: [
    {
      workerSid: 'WK-document-adder',
      section: {
        sectionId: '5e127299-17ba-4adf-a040-69dac9ca45bf',
        sectionTypeSpecificData: {
          comments: 'test file!',
          fileName: 'sample1.pdf',
        },
      },
    },
    {
      workerSid: 'WK-document-adder',
      section: {
        sectionId: '10d21f35-142c-4538-92db-d558f80898ae',
        sectionTypeSpecificData: {
          comments: '',
          fileName: 'sample2.pdf',
        },
      },
    },
  ],
};

export const conversationMedia: NewConversationMedia[] = [
  {
    storeType: 'S3',
    storeTypeSpecificData: {
      type: S3ContactMediaType.TRANSCRIPT,
      location: {
        bucket: 'mock-bucket',
        key: 'mockKey',
      },
    },
  },
];
