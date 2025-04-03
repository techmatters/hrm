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

import {
  ApiTestSuiteParameters,
  basicHeaders,
  getInternalServer,
  getRequest,
  getServer,
  headers,
  useOpenRules,
} from '../server';
import {
  mockingProxy,
  mockSsmParameters,
  mockSuccessfulTwilioAuthentication,
} from '@tech-matters/testing';
import { accountSid, ALWAYS_CAN, workerSid } from '../mocks';
import {
  CaseService,
  createCase,
  getCase,
} from '@tech-matters/hrm-core/case/caseService';
import {
  CaseSection,
  NewCaseSection,
} from '@tech-matters/hrm-core/case/caseSection/types';
import each from 'jest-each';
import {
  createCaseSection,
  getCaseSection,
} from '@tech-matters/hrm-core/case/caseSection/caseSectionService';
import { clearAllTables } from '../dbCleanup';
import { setupTestQueues } from '../sqs';

const SEARCH_INDEX_SQS_QUEUE_NAME = 'mock-search-index-queue';

useOpenRules();
const publicServer = getServer();
const publicRequest = getRequest(publicServer);

const internalServer = getInternalServer();
const internalRequest = getRequest(internalServer);

beforeAll(async () => {
  await clearAllTables();
  await mockingProxy.start(false);
  await mockSuccessfulTwilioAuthentication(workerSid);
  const mockttp = await mockingProxy.mockttpServer();
  await mockSsmParameters(mockttp, [
    {
      pathPattern: /.*\/queue-url-consumer$/,
      valueGenerator: () => SEARCH_INDEX_SQS_QUEUE_NAME,
    },
  ]);
});

afterAll(async () => {
  await mockingProxy.stop();
});

afterEach(async () => {
  await clearAllTables();
});

let targetCase: CaseService;

beforeEach(async () => {
  targetCase = await createCase({}, accountSid, workerSid, undefined, true);
});

setupTestQueues([SEARCH_INDEX_SQS_QUEUE_NAME]);

const getRoutePath = (caseId: string | number, sectionType: string, sectionId?: string) =>
  `/v0/accounts/${accountSid}/cases/${caseId}/sections/${sectionType}${
    sectionId ? `/${sectionId}` : ''
  }`;

const publicApiTestSuiteParameters = {
  request: publicRequest,
  requestDescription: 'PUBLIC',
  route: '',
  testHeaders: headers,
};

const internalApiTestSuiteParameters = {
  request: internalRequest,
  requestDescription: 'INTERNAL',
  route: `/internal`,
  testHeaders: basicHeaders,
};

each([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe(
  '[$requestDescription] POST /cases/:caseId/sections',
  ({
    request,
    testHeaders,
    route: baseRoute,
    requestDescription,
  }: ApiTestSuiteParameters) => {
    test('should return 401 if valid auth headers are not set', async () => {
      const response = await request
        .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
        .send({ sectionTypeSpecificData: { note: 'hello' } });
      expect(response.status).toBe(401);
    });

    test("should return 404 if case doesn't exist", async () => {
      const response = await request
        .post(`${baseRoute}${getRoutePath(targetCase.id + 1, 'note')}`)
        .set(testHeaders)
        .send({ sectionTypeSpecificData: { note: 'hello' } });
      expect(response.status).toBe(404);
    });

    type TestCase = {
      description: string;
      newSection: NewCaseSection;
    };

    const testCases: TestCase[] = [
      {
        description:
          'no sectionId specified should create a new section & assign a section id',
        newSection: { sectionTypeSpecificData: { note: 'hello' } },
      },
      {
        description:
          'sectionId specified should create a new section & use that section id',
        newSection: {
          sectionTypeSpecificData: { note: 'hello' },
          sectionId: 'a-specific-id',
        },
      },
      {
        description:
          'eventTimestamp specified: should use this in preference to created time',
        newSection: {
          sectionTypeSpecificData: { note: 'hello' },
          eventTimestamp: new Date(2000, 0, 1).toISOString(),
        },
      },
      {
        description:
          'any created info should be ignored and the user credentials & current time should be used instead',
        newSection: {
          sectionTypeSpecificData: { note: 'hello' },
          createdBy: 'fake news',
          createdAt: '1979-04-21',
        } as NewCaseSection,
      },
      {
        description:
          'any update info should be ignored and the updated fields should be left null instead',
        newSection: {
          sectionTypeSpecificData: { note: 'hello' },
          updatedBy: 'fake news',
          updatedAt: '2079-04-21',
        } as NewCaseSection,
      },
    ];

    each(testCases).test('$description', async ({ newSection }: TestCase) => {
      const startTime = Date.now();

      const response = await request
        .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
        .set(testHeaders)
        .send(newSection);
      expect(response.status).toBe(200);
      const apiSection: CaseSection = response.body;
      expect(apiSection).toEqual({
        sectionId: expect.any(String),
        sectionType: 'note',
        ...newSection, // Will overwrite sectionId expectation if specified
        createdBy: requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
        createdAt: expect.toParseAsDate(),
        eventTimestamp: expect.toParseAsDate(newSection.eventTimestamp),
        updatedAt: null,
        updatedBy: null,
      });
      const updatedCase = await getCase(targetCase.id, accountSid, ALWAYS_CAN);
      const { sectionType, ...expectedSection } = apiSection;

      // Test that parent case updatedAt is bumped
      expect(new Date(updatedCase!.updatedAt).getTime()).toBeGreaterThan(startTime);
      expect(updatedCase).toEqual({
        ...targetCase,
        updatedAt: updatedCase?.updatedAt,
        updatedBy: requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
        connectedContacts: [],
        info: null,
        sections: {
          note: [
            {
              ...expectedSection,
              createdAt: expect.toParseAsDate(apiSection.createdAt),
              eventTimestamp: expect.toParseAsDate(apiSection.eventTimestamp),
            },
          ],
        },
      });
    });

    test('Multiple calls add 1 section each', async () => {
      const startTime = Date.now();

      const apiSections: CaseSection[] = await Promise.all(
        [1, 2, 3].map(async idx => {
          const newSection: NewCaseSection = {
            sectionTypeSpecificData: { note: `hello ${idx}` },
          };
          const response = await request
            .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
            .set(testHeaders)
            .send(newSection);
          expect(response.status).toBe(200);
          return response.body;
        }),
      );

      const updatedCase = await getCase(targetCase.id, accountSid, ALWAYS_CAN);

      // Test that parent case updatedAt is bumped
      expect(new Date(updatedCase!.updatedAt).getTime()).toBeGreaterThan(startTime);
      expect(updatedCase).toEqual({
        ...targetCase,
        updatedAt: updatedCase?.updatedAt,
        updatedBy: requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
        connectedContacts: [],
        info: null,
        sections: {
          note: expect.arrayContaining(
            apiSections.map(apiSection => {
              const { sectionType, ...expectedSection } = apiSection;
              return {
                ...expectedSection,
                createdAt: expect.toParseAsDate(apiSection.createdAt),
                eventTimestamp: expect.toParseAsDate(apiSection.eventTimestamp),
              };
            }),
          ),
        },
      });
      expect(updatedCase.sections.note).toHaveLength(3);
    });

    test('Multiple calls with same specific section ID - will return a 409 after the first', async () => {
      const startTime = Date.now();

      const newSection: NewCaseSection = {
        sectionId: 'specific-id',
        sectionTypeSpecificData: { note: `hello` },
      };
      const firstResponse = await request
        .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
        .set(testHeaders)
        .send(newSection);
      expect(firstResponse.status).toBe(200);
      const addedSection = firstResponse.body;
      const secondResponse = await request
        .post(`${baseRoute}${getRoutePath(targetCase.id, 'note')}`)
        .set(testHeaders)
        .send(newSection);
      expect(secondResponse.status).toBe(409);

      const updatedCase = await getCase(targetCase.id, accountSid, ALWAYS_CAN);
      expect(new Date(updatedCase!.updatedAt).getTime()).toBeGreaterThan(startTime);
      const { sectionType, ...expectedSection } = addedSection;
      expect(updatedCase).toEqual({
        ...targetCase,
        updatedAt: updatedCase?.updatedAt,
        updatedBy: requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
        connectedContacts: [],
        info: null,
        sections: {
          note: [
            {
              ...expectedSection,
              sectionId: 'specific-id',
              createdAt: expect.toParseAsDate(addedSection.createdAt),
              eventTimestamp: expect.toParseAsDate(addedSection.eventTimestamp),
            },
          ],
        },
      });
      expect(updatedCase.sections.note).toHaveLength(1);
    });
  },
);

describe('/cases/:caseId/sections/:sectionId', () => {
  let targetSection: CaseSection;

  beforeEach(async () => {
    targetSection = (
      await createCaseSection(
        accountSid,
        targetCase.id.toString(),
        'note',
        { sectionTypeSpecificData: { note: 'hello' } },
        workerSid,
      )
    ).unwrap();
  });

  describe('GET', () => {
    const request = publicRequest;
    test('should return 401 if valid auth headers are not set', async () => {
      const response = await request.get(
        getRoutePath(targetCase.id, 'note', targetSection.sectionId),
      );
      expect(response.status).toBe(401);
    });

    test("should return 404 if case doesn't exist", async () => {
      const response = await request
        .get(getRoutePath(targetCase.id + 1, 'note', targetSection.sectionId))
        .set(headers);
      expect(response.status).toBe(404);
    });

    test("should return 404 if case section doesn't exist", async () => {
      const response = await request
        .get(getRoutePath(targetCase.id, 'note', 'nothing-here'))
        .set(headers);
      expect(response.status).toBe(404);
    });

    test('should return a 200 & the section for a case section that exists', async () => {
      const response = await request
        .get(getRoutePath(targetCase.id, 'note', targetSection.sectionId))
        .set(headers);
      expect(response.status).toBe(200);
      const apiSection: CaseSection = response.body;
      const { sectionId, ...expectedSection } = targetSection;
      expect(apiSection).toEqual({
        ...expectedSection,
        createdBy: workerSid,
        createdAt: expect.toParseAsDate(),
        eventTimestamp: expect.toParseAsDate(),
        updatedAt: null,
        updatedBy: null,
      });
    });
  });

  each([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe(
    '[$requestDescription] PUT',
    ({
      request,
      route: baseRoute,
      testHeaders,
      requestDescription,
    }: ApiTestSuiteParameters) => {
      test('should return 401 if valid auth headers are not set', async () => {
        const response = await request
          .put(
            `${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`,
          )
          .send({ sectionTypeSpecificData: { note: 'goodbye' } });

        expect(response.status).toBe(401);
      });

      test("should return 404 if case doesn't exist", async () => {
        const response = await request
          .get(
            `${baseRoute}${getRoutePath(
              targetCase.id + 1,
              'note',
              targetSection.sectionId,
            )}`,
          )
          .set(testHeaders)
          .send({ sectionTypeSpecificData: { note: 'goodbye' } });
        expect(response.status).toBe(404);
      });

      test("should return 404 if case section doesn't exist", async () => {
        const response = await request
          .get(`${baseRoute}${getRoutePath(targetCase.id, 'note', 'nothing-here')}`)
          .set(testHeaders)
          .send({ sectionTypeSpecificData: { note: 'goodbye' } });
        expect(response.status).toBe(404);
      });

      type TestCase = {
        description: string;
        newSection: NewCaseSection;
      };

      const testCases: TestCase[] = [
        {
          description:
            'sectionTypeSpecificData should be replaced with that specified in the payload',
          newSection: { sectionTypeSpecificData: { note: 'goodbye' } },
        },
        {
          description:
            'any created info specified should be ignored and the original created info should not be changed',
          newSection: {
            sectionTypeSpecificData: { note: 'goodbye' },
            createdBy: 'fake news',
            createdAt: '1979-04-21',
          } as NewCaseSection,
        },
        {
          description:
            'any update info should be ignored and the user credentials & current time should be used instead',
          newSection: {
            sectionTypeSpecificData: { note: 'goodbye' },
            updatedBy: 'fake news',
            updatedAt: '2079-04-21',
          } as NewCaseSection,
        },
      ];

      each(testCases).test('$description', async ({ newSection }: TestCase) => {
        const startTime = Date.now();

        const response = await request
          .put(
            `${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`,
          )
          .set(testHeaders)
          .send(newSection);
        expect(response.status).toBe(200);
        const apiSection: CaseSection = response.body;
        expect(apiSection).toEqual({
          ...newSection, // Will overwrite sectionId expectation if specified
          sectionId: targetSection.sectionId,
          sectionType: 'note',
          createdAt: expect.toParseAsDate(targetSection.createdAt),
          eventTimestamp: expect.toParseAsDate(targetSection.eventTimestamp),
          createdBy: workerSid,
          updatedBy:
            requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
          updatedAt: expect.toParseAsDate(),
        });
        const updatedCase = await getCase(targetCase.id, accountSid, ALWAYS_CAN);
        const { sectionType, ...expectedSection } = apiSection;

        // Test that parent case updatedAt is bumped
        expect(new Date(updatedCase!.updatedAt).getTime()).toBeGreaterThan(startTime);
        expect(updatedCase).toEqual({
          ...targetCase,
          updatedAt: updatedCase?.updatedAt,
          updatedBy:
            requestDescription === 'PUBLIC' ? workerSid : `account-${accountSid}`,
          connectedContacts: [],
          info: null,
          sections: {
            note: [
              {
                ...expectedSection,
                createdAt: expect.toParseAsDate(apiSection.createdAt),
                updatedAt: expect.toParseAsDate(apiSection.updatedAt),
                eventTimestamp: expect.toParseAsDate(apiSection.eventTimestamp),
              },
            ],
          },
        });
      });
    },
  );

  each([publicApiTestSuiteParameters, internalApiTestSuiteParameters]).describe(
    '[$requestDescription] DELETE',
    ({ request, route: baseRoute, testHeaders }: ApiTestSuiteParameters) => {
      const verifySectionWasntDeleted = async () => {
        const { sectionId, ...expectedSection } = targetSection;
        const section = await getCaseSection(
          accountSid,
          targetCase.id.toString(),
          'note',
          targetSection.sectionId,
        );
        expect(section).toEqual(expectedSection);
      };

      test('should return 401 if valid auth headers are not set', async () => {
        const response = await request.delete(
          `${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`,
        );
        expect(response.status).toBe(401);
        await verifySectionWasntDeleted();
      });

      test("should return 404 if case doesn't exist", async () => {
        const response = await request
          .delete(
            `${baseRoute}${getRoutePath(
              targetCase.id + 1,
              'note',
              targetSection.sectionId,
            )}`,
          )
          .set(testHeaders);
        expect(response.status).toBe(404);
        await verifySectionWasntDeleted();
      });

      test("should return 404 if case section doesn't exist", async () => {
        const response = await request
          .delete(`${baseRoute}${getRoutePath(targetCase.id, 'note', 'nothing-here')}`)
          .set(testHeaders);
        expect(response.status).toBe(404);
        await verifySectionWasntDeleted();
      });

      test('should return a 200, delete the case & return the deleted section when it exists', async () => {
        const startTime = Date.now();

        const response = await request
          .delete(
            `${baseRoute}${getRoutePath(targetCase.id, 'note', targetSection.sectionId)}`,
          )
          .set(testHeaders);
        expect(response.status).toBe(200);
        const section = await getCaseSection(
          accountSid,
          targetCase.id.toString(),
          'note',
          targetSection.sectionId,
        );
        expect(section).not.toBeDefined();

        const updatedCase = await getCase(
          targetCase.id,
          targetCase.accountSid,
          ALWAYS_CAN,
        );

        // Test that parent case updatedAt is bumped
        expect(new Date(updatedCase!.updatedAt).getTime()).toBeGreaterThan(startTime);
      });
    },
  );
});
