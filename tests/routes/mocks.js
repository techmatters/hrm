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
// Data contact withouth caseInformation.callSummary (can be empty string but no undefined)
const invalid1 = {
  ...contact1,
  form: { ...contact1.form, caseInformation: { keepConfidential: false } },
};

module.exports = { contact1, contact2, broken1, broken2, invalid1 };
