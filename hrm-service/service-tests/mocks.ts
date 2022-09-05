import { Case } from '../src/case/case';
import { CreateContactPayloadWithFormProperty } from '../src/contact/contact';
import { Contact } from '../src/contact/contact-data-access';

export const accountSid = 'ACCOUNT_SID';
// TODO: Turn these into proper API types (will probably break so many tests...)
export const contact1: CreateContactPayloadWithFormProperty = {
  form: {
    callType: 'Child calling about self',
    childInformation: {
      name: {
        firstName: 'Jhonny',
        lastName: 'Theboy qwerty',
      },
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
      categories: {},
    },
    callerInformation: {
      name: {
        firstName: '',
        lastName: '',
      },
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
  twilioWorkerId: 'worker-sid',
  createdBy: 'worker-sid',
  helpline: '',
  queueName: '',
  number: '12025550184',
  channel: 'chat',
  conversationDuration: 14,
};

export const contact2: CreateContactPayloadWithFormProperty = {
  form: {
    callType: 'Someone calling about a child',
    childInformation: {
      name: {
        firstName: 'Name',
        lastName: 'Random',
      },
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
      categories: {},
    },
    callerInformation: {
      name: {
        firstName: 'Jhon qwerty',
        lastName: 'Thecaller',
      },
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
  twilioWorkerId: 'worker-sid',
  createdBy: 'worker-sid',
  helpline: '',
  queueName: '',
  number: '12025550184',
  channel: 'chat',
  conversationDuration: 10,
};

export const nonData1: CreateContactPayloadWithFormProperty = {
  ...contact1,
  form: {
    callType: 'Joke',
    childInformation: { name: contact1.form.childInformation.name },
    caseInformation: { categories: {}, callSummary: '' },
    callerInformation: { name: contact1.form.callerInformation.name },
  },
};
export const nonData2: CreateContactPayloadWithFormProperty = {
  ...contact2,
  form: {
    callType: 'Blank',
    childInformation: { name: contact2.form.childInformation.name },
    caseInformation: { categories: {}, callSummary: '' },
    callerInformation: { name: contact2.form.callerInformation.name },
  },
};
// Non data contacts with actual information
export const broken1: CreateContactPayloadWithFormProperty = {
  ...contact1,
  form: { ...contact1.form, callType: 'Joke' },
};
export const broken2: CreateContactPayloadWithFormProperty = {
  ...contact2,
  form: { ...contact2.form, callType: 'Blank' },
};

export const anotherChild: Contact['rawJson']['childInformation'] = {
  ...contact1.form.childInformation,
  name: {
    firstName: 'Marie',
    lastName: 'Curie',
  },
};

export const anotherCaller: Contact['rawJson']['callerInformation'] = {
  ...contact2.form.callerInformation,
  name: {
    firstName: 'Marie',
    lastName: 'Curie',
  },
};

export const another1: CreateContactPayloadWithFormProperty = {
  ...contact1,
  form: { ...contact1.form, childInformation: anotherChild },
  helpline: 'Helpline 1',
};

export const another2: CreateContactPayloadWithFormProperty = {
  ...contact2,
  form: {
    ...contact2.form,
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

export const noHelpline: CreateContactPayloadWithFormProperty = {
  ...another1,
  helpline: '',
};

export const withTaskId: CreateContactPayloadWithFormProperty = {
  form: {
    callType: 'Child calling about self',
    childInformation: {
      name: {
        firstName: 'withTaskId',
        lastName: 'withTaskId',
      },
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
    callerInformation: contact1.form.callerInformation,
    caseInformation: contact1.form.caseInformation,
  },
  twilioWorkerId: 'worker-sid',
  createdBy: 'worker-sid',
  helpline: 'withTaskId',
  queueName: '',
  number: '11111111111',
  channel: 'chat',
  conversationDuration: 1,
  taskId: 'taskId',
};

export const case1: Partial<Case> = {
  status: 'open',
  helpline: 'helpline',
  info: {
    counsellorNotes: [
      {
        note: 'Child with covid-19',
        twilioWorkerId: 'note-adder',
        createdAt: '2022-01-01T00:00:00+00:00',
        customProperty: 'something else',
      },
    ],
  },
  twilioWorkerId: 'worker-sid',
  createdBy: 'worker-sid',
  accountSid,
};

export const case2: Partial<Case> = {
  status: 'open',
  helpline: 'helpline',
  info: {
    counsellorNotes: [
      {
        note: 'Refugee child',
        twilioWorkerId: 'other-note-adder',
        createdAt: '2021-01-01T00:00:00+00:00',
      },
    ],
  },
  twilioWorkerId: 'worker-sid',
  createdBy: 'worker-sid',
  accountSid,
};

export const workerSid = 'worker-sid';
