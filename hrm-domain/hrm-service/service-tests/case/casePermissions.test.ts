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

/* eslint-disable jest/no-standalone-expect,no-await-in-loop */

import each from 'jest-each';

import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import { CaseService } from '@tech-matters/hrm-core/case/caseService';
import * as caseDb from '@tech-matters/hrm-core/case/caseDataAccess';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';

import * as mocks from '../mocks';
import { ruleFileWithOnePermittedOrDeniedAction } from '../permissions-overrides';
import { headers, getRequest, getServer, setRules, useOpenRules } from '../server';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { case1, accountSid, workerSid } = mocks;

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
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

  const cases: Record<string, CaseService> = {};
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
    await Promise.all(
      [cases.blank, cases.populated].map(c => {
        if (c) {
          return caseDb.deleteById(c.id, accountSid);
        }
        console.warn(`No case to delete when cleaning up`);
        return Promise.resolve();
      }),
    );
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
          actionToTest: 'editCaseOverview',
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

        setRules(
          ruleFileWithOnePermittedOrDeniedAction(actionToTest, !testingDeniedCase),
        );
        const permittedResponse = await request
          .put(subRoute(originalCase.id))
          .set(headers)
          .send(update);

        expect(permittedResponse.status).toBe(testingDeniedCase ? 401 : 200);
        useOpenRules();
      },
    );
  });
});
