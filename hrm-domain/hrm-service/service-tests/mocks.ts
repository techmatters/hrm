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

import { CaseService } from '../src/case/caseService';
import { channelTypes } from '../src/contact/channelTypes';
import { S3ContactMediaType } from '../src/conversation-media/conversation-media';
import { Contact } from '../src/contact/contactDataAccess';
import { CreateContactPayload } from '../src/contact/contactService';

export const accountSid = 'ACCOUNT_SID';
// TODO: Turn these into proper API types (will probably break so many tests...)
export const contact1: CreateContactPayload = {
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

export const contact2: CreateContactPayload = {
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

export const nonData1: CreateContactPayload = {
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
export const nonData2: CreateContactPayload = {
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
export const broken1: CreateContactPayload = {
  ...contact1,
  taskId: 'broken1-task-sid',
  rawJson: { ...contact1.rawJson, callType: 'Joke' },
};
export const broken2: CreateContactPayload = {
  ...contact2,
  taskId: 'broken2-task-sid',
  rawJson: { ...contact2.rawJson, callType: 'Blank' },
};

export const anotherChild: Contact['rawJson']['childInformation'] = {
  ...contact1.rawJson.childInformation,
  firstName: 'Marie',
  lastName: 'Curie',
};

export const anotherCaller: Contact['rawJson']['callerInformation'] = {
  ...contact2.rawJson.callerInformation,
  firstName: 'Marie',
  lastName: 'Curie',
};

export const another1: CreateContactPayload = {
  ...contact1,
  taskId: 'another1-task-sid',
  rawJson: { ...contact1.rawJson, childInformation: anotherChild },
  helpline: 'Helpline 1',
};

export const another2: CreateContactPayload = {
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

export const noHelpline: CreateContactPayload = {
  ...another1,
  taskId: 'noHelpline-task-sid',
  helpline: '',
};

export const withTaskId: CreateContactPayload = {
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

export const workerSid = 'WK-worker-sid';

export const withTaskIdAndTranscript: CreateContactPayload = {
  ...withTaskId,
  rawJson: {
    ...withTaskId.rawJson,
    childInformation: {
      ...withTaskId.rawJson.childInformation,
      firstName: 'withTaskIdAndTranscript',
      lastName: 'withTaskIdAndTranscript',
    },
  },
  conversationMedia: [
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
  ],
  channel: channelTypes.web,
  taskId: `${withTaskId.taskId}-transcript-permissions-test`,
};
