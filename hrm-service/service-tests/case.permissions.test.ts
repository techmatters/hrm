/* eslint-disable jest/no-standalone-expect,no-await-in-loop */
import * as caseApi from '../src/case/case';
import { Case } from '../src/case/case';
import * as caseDb from '../src/case/case-data-access';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';

const openRules = require('../permission-rules/open.json');
const supertest = require('supertest');
const each = require('jest-each').default;
import { createService } from '../src/app';
import { RulesFile } from '../src/permissions/rulesMap';
const mocks = require('./mocks');

let testRules: RulesFile;

const server = createService({
  permissions: {
    rules: () => testRules,
    cachePermissions: false, // Means we can evaluate different rules each request without restarting the service
  },
  authTokenLookup: () => 'picernic basket',
}).listen();
const request = supertest.agent(server);

const { case1, accountSid, workerSid } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

function ruleFileWithOnePermittedOrDeniedAction(
  permittedAction: string,
  isPermitted: boolean,
): RulesFile {
  const ruleEntries = Object.keys(openRules).map(key => [
    key,
    (key === permittedAction && isPermitted) || (key !== permittedAction && !isPermitted)
      ? [['everyone']]
      : [],
  ]);
  return Object.fromEntries(ruleEntries);
}

afterAll(done => {
  proxiedEndpoints.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
});


describe('/cases/:id route - PUT', () => {
  const route = `/v0/accounts/${accountSid}/cases`;

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

  const cases: Record<string, Case> = {};
  let subRoute;

  beforeEach(async () => {
    cases.blank = await caseApi.createCase({ ...case1, info: {} }, accountSid, workerSid);
    cases.populated = await caseApi.createCase(
      {
        ...case1,
        info: {
          summary: 'something summery',
          perpetrators,
          households,
          incidents,
          documents,
          referrals,
          counsellorNotes,
        },
      },
      accountSid,
      workerSid,
    );
    subRoute = id => `${route}/${id}`;
  });

  afterEach(async () => {
    await caseDb.deleteById(cases.blank.id, accountSid);
    await caseDb.deleteById(cases.populated.id, accountSid);
  });

  describe('Case record updates', () => {
    each(
      [
        {
          caseUpdate: { status: 'closed' },
          changeDescription: 'status changed',
          actionToTest: 'closeCase',
          casesToTest: ['blank', 'populated'],
        },
        {
          infoUpdate: { summary: 'To summarize....' },
          changeDescription: 'summary changed',
          actionToTest: 'editCaseSummary',
          casesToTest: ['blank', 'populated'],
        },
        {
          infoUpdate: oi => ({
            ...oi,
            counsellorNotes: [
              ...(oi.counsellorNotes ?? []),
              {
                id: '3',
                note: 'Added',
                twilioWorkerId: 'note-adder',
                createdAt: '2022-07-01T00:00:00+00:00',
              },
            ],
          }),
          changeDescription: 'note added',
          actionToTest: 'addNote',
          casesToTest: ['blank', 'populated'],
        },
        {
          infoUpdate: oi => ({
            ...oi,
            households: [
              ...(oi.households ?? []),
              {
                household: {
                  firstName: 'Jane',
                  lastName: 'Doe',
                },
                createdAt: '2022-03-15T20:56:22.640Z',
                twilioWorkerId: 'household-adder',
              },
            ],
          }),
          changeDescription: 'household added',
          actionToTest: 'addHousehold',
          casesToTest: ['blank', 'populated'],
        },
        {
          infoUpdate: oi => ({
            ...oi,
            perpetrators: oi.perpetrators.map((p, idx) =>
              idx === 0
                ? {
                    perpetrator: {
                      firstName: 'Jane',
                      lastName: 'Doe',
                    },
                    createdAt: '2022-03-15T20:56:22.640Z',
                    twilioWorkerId: 'perp-editor',
                  }
                : p,
            ),
          }),
          changeDescription: 'perpetrator edited',
          actionToTest: 'editPerpetrator',
          casesToTest: ['populated'],
        },
        {
          infoUpdate: oi => ({
            ...oi,
            documents: oi.documents.map((p, idx) =>
              idx === 0
                ? {
                    id: '5e127299-17ba-4adf-a040-69dac9ca45bf',
                    documents: {
                      comments: 'can I edit the test file?',
                      fileName: 'something_other_than_sample1.pdf',
                    },
                    createdAt: '2022-03-15T20:56:22.640Z',
                    twilioWorkerId: 'perp-editor',
                  }
                : p,
            ),
          }),
          changeDescription: 'documents edited',
          actionToTest: 'editDocument',
          casesToTest: ['populated'],
        },
        {
          infoUpdate: oi => ({
            ...oi,
            households: [
              oi.households[1],
              {
                household: {
                  firstName: 'Jane',
                  lastName: 'Doe',
                },
                createdAt: '2022-03-15T20:56:22.640Z',
                twilioWorkerId: 'household-adder',
              },
              oi.households[0],
            ],
          }),
          changeDescription: 'household added and order changed',
          actionToTest: 'addHousehold',
          casesToTest: ['populated'],
        },
      ].flatMap(tc =>
        tc.casesToTest.flatMap(oc => [
          {
            ...tc,
            testingDeniedCase: false,
            changeDescription: `${oc} case: should return 200 when ${tc.changeDescription} (${tc.actionToTest} is permitted)`,
            originalCase: () => cases[oc],
          },
          {
            ...tc,
            testingDeniedCase: true,
            changeDescription: `${oc} should return 401 when ${tc.changeDescription} (${tc.actionToTest} is prohibited)`,
            originalCase: () => cases[oc],
          },
        ]),
      ),
      //.filter((tc) => tc.changeDescription.includes('populated case: should return 200 when documents edited (editDocument is permitted)')),
    ).test(
      '$changeDescription',
      async ({
        caseUpdate: caseUpdateParam = {},
        infoUpdate: infoUpdateParam = undefined,
        originalCase: originalCaseGetter = () => cases.blank,
        actionToTest,
        testingDeniedCase,
      }) => {
        const caseUpdate =
          typeof caseUpdateParam === 'function' ? caseUpdateParam() : caseUpdateParam;
        const originalCase = originalCaseGetter();
        const update = {
          ...caseUpdate,
        };
        const infoUpdate =
          typeof infoUpdateParam === 'function'
            ? infoUpdateParam(originalCase.info)
            : infoUpdateParam;
        if (infoUpdate) {
          update.info = { ...originalCase.info, ...caseUpdate.info, ...infoUpdate };
        }

        testRules = ruleFileWithOnePermittedOrDeniedAction(actionToTest, !testingDeniedCase);
        const permittedResponse = await request
          .put(subRoute(originalCase.id))
          .set(headers)
          .send(update);

        expect(permittedResponse.status).toBe(testingDeniedCase ? 401 : 200);
      },
    );
  });
});
