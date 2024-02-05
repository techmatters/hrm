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

import { CaseService } from '@tech-matters/hrm-core/case/caseService';
import {
  NewConversationMedia,
  S3ContactMediaType,
} from '@tech-matters/hrm-core/conversation-media/conversation-media';
import { Contact } from '@tech-matters/hrm-core/contact/contactDataAccess';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { twilioUser } from '@tech-matters/twilio-worker-auth';

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
};

export const case1: Partial<CaseService> = {
  status: 'open',
  helpline: 'helpline',
  info: {
    counsellorNotes: [
      {
        note: 'Child with covid-19',
        twilioWorkerId: 'WK-note-adder',
        createdAt: '2022-01-01T00:00:00+00:00',
        customProperty: 'something else',
      },
    ],
  },
  twilioWorkerId: 'WK-worker-sid',
  createdBy: 'WK-worker-sid',
  accountSid,
};

export const case2: Partial<CaseService> = {
  status: 'open',
  helpline: 'helpline',
  info: {
    counsellorNotes: [
      {
        note: 'Refugee child',
        twilioWorkerId: 'WK-other-note-adder',
        createdAt: '2021-01-01T00:00:00+00:00',
      },
    ],
  },
  twilioWorkerId: 'WK-worker-sid',
  createdBy: 'WK-worker-sid',
  accountSid,
};

const counsellorNotes = [
  {
    id: '1',
    note: 'Child with covid-19',
    twilioWorkerId: 'note-adder',
    createdAt: '2022-01-01T00:00:00+00:00',
  },
  {
    id: '2',
    note: 'Child recovered from covid-19',
    twilioWorkerId: 'other-note-adder',
    createdAt: '2022-01-05T00:00:00+00:00',
  },
];
const perpetrators = [
  {
    perpetrator: {
      firstName: 'Jane',
      lastName: 'Doe',
    },
    createdAt: '2021-03-15T20:56:22.640Z',
    twilioWorkerId: 'perpetrator-adder',
  },
  {
    perpetrator: {
      firstName: 'J.',
      lastName: 'Doe',
      phone2: '+12345678',
    },
    createdAt: '2021-03-16T20:56:22.640Z',
    twilioWorkerId: 'perpetrator-adder',
  },
];

const households = [
  {
    household: {
      firstName: 'Jane',
      lastName: 'Doe',
    },
    createdAt: '2021-03-15T20:56:22.640Z',
    twilioWorkerId: 'household-adder',
  },
  {
    household: {
      firstName: 'J.',
      lastName: 'Doe',
      phone2: '+12345678',
    },
    createdAt: '2021-03-16T20:56:22.640Z',
    twilioWorkerId: 'household-adder',
  },
];

const incidents = [
  {
    incident: {
      date: '2021-03-03',
      duration: '',
      location: 'Other',
      isCaregiverAware: null,
      incidentWitnessed: null,
      reactionOfCaregiver: '',
      whereElseBeenReported: '',
      abuseReportedElsewhere: null,
    },
    createdAt: '2021-03-16T20:56:22.640Z',
    twilioWorkerId: 'incident-adder',
  },
];

const referrals = [
  {
    id: '2503',
    date: '2021-02-18',
    comments: 'Referred to state agency',
    createdAt: '2021-02-19T21:38:30.911+00:00',
    referredTo: 'DREAMS',
    twilioWorkerId: 'referral-adder',
  },
];

const documents = [
  {
    id: '5e127299-17ba-4adf-a040-69dac9ca45bf',
    document: {
      comments: 'test file!',
      fileName: 'sample1.pdf',
    },
    createdAt: '2021-09-21T17:57:52.346Z',
    twilioWorkerId: 'document-adder',
  },
  {
    id: '10d21f35-142c-4538-92db-d558f80898ae',
    document: {
      comments: '',
      fileName: 'sample2.pdf',
    },
    createdAt: '2021-09-21T19:47:03.167Z',
    twilioWorkerId: 'document-adder',
  },
];

export const casePopulated = {
  ...case1,
  info: {
    summary: 'something summery',
    followUpDate: '2005-03-15T00:00:00.000Z',
    perpetrators,
    households,
    incidents,
    documents,
    referrals,
    counsellorNotes,
  },
};

export const workerSid = 'WK-worker-sid';

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

export const ALWAYS_CAN = { user: twilioUser(workerSid, []), can: () => true };
