const contact1 = {
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
      location: {
        streetAddress: '',
        city: '',
        stateOrCounty: '',
        postalCode: '',
        phone1: '',
        phone2: '',
      },
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
      location: {
        city: '',
        phone1: '',
        phone2: '',
        postalCode: '',
        stateOrCounty: '',
        streetAddress: '',
      },
    },
  },
  twilioWorkerId: 'fake-worker-123',
  helpline: '',
  queueName: '',
  number: '12025550184',
  channel: 'chat',
  conversationDuration: 14,
};

const contact2 = {
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
      location: {
        streetAddress: '',
        city: '',
        stateOrCounty: '',
        postalCode: '',
        phone1: '',
        phone2: '',
      },
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
      location: {
        city: '',
        phone1: '',
        phone2: '',
        postalCode: '',
        stateOrCounty: '',
        streetAddress: '',
      },
    },
  },
  twilioWorkerId: 'fake-worker-987',
  helpline: '',
  queueName: '',
  number: '12025550184',
  channel: 'chat',
  conversationDuration: 10,
};

// Non data contacts with actual information
const broken1 = { ...contact1, form: { ...contact1.form, callType: 'Joke' } };
const broken2 = { ...contact2, form: { ...contact2.form, callType: 'Blank' } };

const anotherChild = {
  ...contact1.form.childInformation,
  name: {
    firstName: 'Marie',
    lastName: 'Curie',
  },
};

const anotherCaller = {
  ...contact2.form.callerInformation,
  name: {
    firstName: 'Marie',
    lastName: 'Curie',
  },
};

const another1 = {
  ...contact1,
  form: { ...contact1.form, childInformation: anotherChild },
  helpline: 'Helpline 1',
};

const another2 = {
  ...contact2,
  form: {
    ...contact2.form,
    callerInformation: {
      ...anotherCaller,
      location: { phone1: '+1 (515) 555-1212', phone2: '+1 (616) 555-1212' },
    },
    childInformation: {
      ...anotherChild,
      location: { phone1: '(313) 555-1212', phone2: '+1 (414) 555-1212' },
    },
  },
  helpline: 'Helpline 2',
  number: '+12125551212',
};

const noHelpline = {
  ...another1,
  helpline: '',
};

const withTaskId = {
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
      location: {
        streetAddress: '',
        city: '',
        stateOrCounty: '',
        postalCode: '',
        phone1: '',
        phone2: '',
      },
      refugee: false,
    },
  },
  twilioWorkerId: 'not-fake-worker-123',
  helpline: '',
  queueName: '',
  number: '12025550184',
  channel: 'chat',
  conversationDuration: 1,
  taskId: 'taskId',
};

const case1 = {
  status: 'open',
  helpline: 'helpline',
  info: {
    notes: 'Child with covid-19',
  },
  twilioWorkerId: 'fake-worker-129',
};

const case2 = {
  status: 'open',
  helpline: 'helpline',
  info: {
    notes: 'Refugee child',
  },
  twilioWorkerId: 'fake-worker-129',
};

module.exports = {
  contact1,
  contact2,
  broken1,
  broken2,
  another1,
  another2,
  noHelpline,
  withTaskId,
  case1,
  case2,
};
