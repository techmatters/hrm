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

import { getRequest, getServer, headers, useOpenRules } from '../server';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { accountSid, ALWAYS_CAN, workerSid } from '../mocks';
import { db } from '@tech-matters/hrm-core/connection-pool';
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

useOpenRules();
const server = getServer();
const request = getRequest(server);

const cleanUpDB = async () => {
  await db.multi(`
    DELETE FROM "CaseSections";
    DELETE FROM "Cases";
    DELETE FROM "Contacts";
  `);
};

beforeAll(async () => {
  await cleanUpDB();
  await mockingProxy.start(false);
  await mockSuccessfulTwilioAuthentication(workerSid);
});

afterAll(async () => {
  await mockingProxy.stop();
});

afterEach(async () => {
  await cleanUpDB();
});

let targetCase: CaseService;

beforeEach(async () => {
  targetCase = await createCase({}, accountSid, workerSid);
});

const getRoutePath = (caseId: string | number, sectionType: string, sectionId?: string) =>
  `/v0/accounts/${accountSid}/cases/${caseId}/sections/${sectionType}${
    sectionId ? `/${sectionId}` : ''
  }`;

describe('POST /cases/:caseId/sections', () => {
  test('should return 401 if valid auth headers are not set', async () => {
    const response = await request
      .post(getRoutePath(targetCase.id, 'note'))
      .send({ sectionTypeSpecificData: { note: 'hello' } });
    expect(response.status).toBe(401);
  });

  test("should return 404 if case doesn't exist", async () => {
    const response = await request
      .post(getRoutePath(targetCase.id + 1, 'note'))
      .set(headers)
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
    const response = await request
      .post(getRoutePath(targetCase.id, 'note'))
      .set(headers)
      .send(newSection);
    expect(response.status).toBe(200);
    const apiSection: CaseSection = response.body;
    expect(apiSection).toEqual({
      sectionId: expect.any(String),
      ...newSection, // Will overwrite sectionId expectation if specified
      createdBy: workerSid,
      createdAt: expect.toParseAsDate(),
      updatedAt: null,
      updatedBy: null,
    });
    const updatedCase = await getCase(targetCase.id, accountSid, ALWAYS_CAN);
    expect(updatedCase).toEqual({
      ...targetCase,
      connectedContacts: [],
      info: {
        counsellorNotes: [
          {
            ...newSection.sectionTypeSpecificData,
            id: expect.any(String),
            accountSid,
            twilioWorkerId: workerSid,
            createdAt: expect.toParseAsDate(apiSection.createdAt),
          },
        ],
      },
      sections: {
        note: [{ ...apiSection, createdAt: expect.toParseAsDate(apiSection.createdAt) }],
      },
    });
  });

  test('Multiple calls add 1 section each', async () => {
    const apiSections: CaseSection[] = await Promise.all(
      [1, 2, 3].map(async idx => {
        const newSection: NewCaseSection = {
          sectionTypeSpecificData: { note: `hello ${idx}` },
        };
        const response = await request
          .post(getRoutePath(targetCase.id, 'note'))
          .set(headers)
          .send(newSection);
        expect(response.status).toBe(200);
        return response.body;
      }),
    );

    const updatedCase = await getCase(targetCase.id, accountSid, ALWAYS_CAN);
    expect(updatedCase).toEqual({
      ...targetCase,
      connectedContacts: [],
      info: {
        counsellorNotes: expect.arrayContaining(
          apiSections.map(apiSection => ({
            ...apiSection.sectionTypeSpecificData,
            id: expect.any(String),
            accountSid,
            twilioWorkerId: workerSid,
            createdAt: expect.toParseAsDate(apiSection.createdAt),
          })),
        ),
      },
      sections: {
        note: expect.arrayContaining(
          apiSections.map(apiSection => ({
            ...apiSection,
            createdAt: expect.toParseAsDate(apiSection.createdAt),
          })),
        ),
      },
    });
    expect(updatedCase.info.counsellorNotes).toHaveLength(3);
    expect(updatedCase.sections.note).toHaveLength(3);
  });
});

describe('/cases/:caseId/sections/:sectionId', () => {
  let targetSection: CaseSection;

  beforeEach(async () => {
    targetSection = await createCaseSection(
      accountSid,
      targetCase.id.toString(),
      'note',
      { sectionTypeSpecificData: { note: 'hello' } },
      workerSid,
    );
  });

  describe('GET', () => {
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
        updatedAt: null,
        updatedBy: null,
      });
    });
  });

  describe('PUT', () => {
    test('should return 401 if valid auth headers are not set', async () => {
      const response = await request
        .put(getRoutePath(targetCase.id, 'note', targetSection.sectionId))
        .send({ sectionTypeSpecificData: { note: 'goodbye' } });

      expect(response.status).toBe(401);
    });

    test("should return 404 if case doesn't exist", async () => {
      const response = await request
        .get(getRoutePath(targetCase.id + 1, 'note', targetSection.sectionId))
        .set(headers)
        .send({ sectionTypeSpecificData: { note: 'goodbye' } });
      expect(response.status).toBe(404);
    });

    test("should return 404 if case section doesn't exist", async () => {
      const response = await request
        .get(getRoutePath(targetCase.id, 'note', 'nothing-here'))
        .set(headers)
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
      const response = await request
        .put(getRoutePath(targetCase.id, 'note', targetSection.sectionId))
        .set(headers)
        .send(newSection);
      expect(response.status).toBe(200);
      const apiSection: CaseSection = response.body;
      expect(apiSection).toEqual({
        ...newSection, // Will overwrite sectionId expectation if specified
        sectionId: targetSection.sectionId,
        createdAt: expect.toParseAsDate(targetSection.createdAt),
        createdBy: workerSid,
        updatedBy: workerSid,
        updatedAt: expect.toParseAsDate(),
      });
      const updatedCase = await getCase(targetCase.id, accountSid, ALWAYS_CAN);
      expect(updatedCase).toEqual({
        ...targetCase,
        connectedContacts: [],
        info: {
          counsellorNotes: [
            {
              ...newSection.sectionTypeSpecificData,
              id: targetSection.sectionId,
              accountSid,
              twilioWorkerId: workerSid,
              createdAt: expect.toParseAsDate(targetSection.createdAt),
              updatedAt: expect.toParseAsDate(),
              updatedBy: workerSid,
            },
          ],
        },
        sections: {
          note: [
            {
              ...apiSection,
              createdAt: expect.toParseAsDate(apiSection.createdAt),
              updatedAt: expect.toParseAsDate(apiSection.updatedAt),
            },
          ],
        },
      });
    });
  });

  describe('DELETE', () => {
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
        getRoutePath(targetCase.id, 'note', targetSection.sectionId),
      );
      expect(response.status).toBe(401);
      await verifySectionWasntDeleted();
    });

    test("should return 404 if case doesn't exist", async () => {
      const response = await request
        .delete(getRoutePath(targetCase.id + 1, 'note', targetSection.sectionId))
        .set(headers);
      expect(response.status).toBe(404);
      await verifySectionWasntDeleted();
    });

    test("should return 404 if case section doesn't exist", async () => {
      const response = await request
        .delete(getRoutePath(targetCase.id, 'note', 'nothing-here'))
        .set(headers);
      expect(response.status).toBe(404);
      await verifySectionWasntDeleted();
    });

    test('should return a 200, delete the case & return the deleted section when it exists', async () => {
      const response = await request
        .delete(getRoutePath(targetCase.id, 'note', targetSection.sectionId))
        .set(headers);
      expect(response.status).toBe(200);
      const section = await getCaseSection(
        accountSid,
        targetCase.id.toString(),
        'note',
        targetSection.sectionId,
      );
      expect(section).not.toBeDefined();
    });
  });
});
