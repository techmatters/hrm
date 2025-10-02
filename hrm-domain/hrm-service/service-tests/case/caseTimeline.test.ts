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

import { headers } from '../server';
import {
  accountSid,
  ALWAYS_CAN,
  another2,
  contact1,
  contact2,
  workerSid,
} from '../mocks';
import { CaseService, createCase } from '@tech-matters/hrm-core/case/caseService';
import {
  isCaseSectionTimelineActivity,
  NewCaseSection,
} from '@tech-matters/hrm-core/case/caseSection/types';
import each from 'jest-each';
import { createCaseSection } from '@tech-matters/hrm-core/case/caseSection/caseSectionService';
import { addDays, addHours, parseISO } from 'date-fns';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import {
  connectContactToCase,
  Contact,
  createContact,
} from '@tech-matters/hrm-core/contact/contactService';
import { TimelineActivity } from '@tech-matters/hrm-types';
import { setupServiceTests } from '../setupServiceTest';

const { request } = setupServiceTests(workerSid);

const BASELINE_DATE = new Date(2000, 0, 1);

let sampleCase: CaseService;
let expectedContacts: Contact[];

const definitionVersion = 'as-v1';

beforeEach(async () => {
  sampleCase = await createCase(
    { definitionVersion },
    accountSid,
    workerSid,
    undefined,
    true,
  );
  const sampleSections: Record<string, NewCaseSection[]> = {
    sectionType1: [
      {
        sectionTypeSpecificData: {
          text: 'Type 1, Item 1',
        },
        eventTimestamp: BASELINE_DATE.toISOString(),
      },
      {
        sectionTypeSpecificData: {
          text: 'Type 1, Item 2',
        },
        eventTimestamp: addDays(BASELINE_DATE, 1).toISOString(),
      },

      {
        sectionTypeSpecificData: {
          text: 'Type 1, Item 3',
        },
        eventTimestamp: addDays(BASELINE_DATE, 2).toISOString(),
      },
    ],
    sectionType2: [
      {
        sectionTypeSpecificData: {
          text: 'Type 2, Item 1',
        },
        eventTimestamp: addHours(BASELINE_DATE, 6).toISOString(),
      },
      {
        sectionTypeSpecificData: {
          text: 'Type 2, Item 2',
        },
        eventTimestamp: addHours(addDays(BASELINE_DATE, 1), 6).toISOString(),
      },

      {
        sectionTypeSpecificData: {
          text: 'Type 2, Item 3',
        },
        eventTimestamp: addHours(addDays(BASELINE_DATE, 2), 6).toISOString(),
      },
    ],
  };
  await Promise.all(
    Object.entries(sampleSections).flatMap(([sectionType, newSections]) =>
      newSections.map(ns =>
        createCaseSection(
          accountSid,
          sampleCase.id.toString(),
          sectionType,
          ns,
          workerSid,
          true,
        ),
      ),
    ),
  );

  const sampleContacts: NewContactRecord[] = [
    {
      ...contact1,
      timeOfContact: addHours(BASELINE_DATE, 3).toISOString(),
      helpline: 'Contact 1 Helpline',
    },

    {
      ...contact2,
      timeOfContact: addDays(addHours(BASELINE_DATE, 3), 1).toISOString(),
      helpline: 'Contact 2 Helpline',
    },
    {
      ...another2,
      timeOfContact: addDays(addHours(BASELINE_DATE, 3), 2).toISOString(),
      helpline: 'Contact 3 Helpline',
    },
  ];

  expectedContacts = (
    await Promise.all(
      sampleContacts.map(async c => {
        const created = await createContact(accountSid, workerSid, c, ALWAYS_CAN, true);
        return connectContactToCase(
          accountSid,
          created.id.toString(),
          sampleCase.id.toString(),
          ALWAYS_CAN,
          true,
        );
      }),
    )
  )
    .sort(
      (a, b) => parseISO(a.timeOfContact).valueOf() - parseISO(b.timeOfContact).valueOf(),
    )
    .map(c => {
      const { totalCount, conversationMedia, csamReports, referrals, ...contact } =
        c as any;
      return {
        ...contact,
        timeOfContact: expect.toParseAsDate(contact.timeOfContact),
        createdAt: expect.toParseAsDate(contact.createdAt),
        updatedAt: expect.toParseAsDate(contact.updatedAt),
      };
    });
});

const getRoutePath = (
  caseId: string | number,
  sectionTypes: string[],
  includeContacts: boolean,
  offset?: number,
  limit?: number,
) =>
  `/v0/accounts/${accountSid}/cases/${caseId}/timeline?sectionTypes=${sectionTypes.join(
    ',',
  )}&includeContacts=${includeContacts}${
    typeof limit === 'number' ? `&limit=${limit}` : ''
  }${typeof offset === 'number' ? `&offset=${offset}` : ''}`;

describe('GET /cases/:caseId/timeline', () => {
  test('should return 401 if valid auth headers are not set', async () => {
    const response = await request.get(
      getRoutePath(sampleCase.id, ['sectionType1'], false),
    );
    expect(response.status).toBe(401);
  });

  test("should return 404 if case doesn't exist", async () => {
    const response = await request
      .post(getRoutePath(sampleCase.id + 1, ['sectionType1'], false))
      .set(headers);
    expect(response.status).toBe(404);
  });

  type TestCase = {
    description: string;
    includeContacts: boolean;
    sectionTypes: string[];
    limit?: number;
    offset?: number;
    expectedActivityDescriptions: string[];
    expectedTotalCount: number;
  };

  const testCases: TestCase[] = [
    {
      description: 'All sections and include contacts - returns everything',
      includeContacts: true,
      sectionTypes: ['sectionType1', 'sectionType2'],
      expectedActivityDescriptions: [
        'Type 2, Item 3',
        'Contact 3 Helpline',
        'Type 1, Item 3',
        'Type 2, Item 2',
        'Contact 2 Helpline',
        'Type 1, Item 2',
        'Type 2, Item 1',
        'Contact 1 Helpline',
        'Type 1, Item 1',
      ],
      expectedTotalCount: 9,
    },
    {
      description: 'All sections and exclude contacts - returns all sections',
      includeContacts: false,
      sectionTypes: ['sectionType1', 'sectionType2'],
      expectedActivityDescriptions: [
        'Type 2, Item 3',
        'Type 1, Item 3',
        'Type 2, Item 2',
        'Type 1, Item 2',
        'Type 2, Item 1',
        'Type 1, Item 1',
      ],
      expectedTotalCount: 6,
    },
    {
      description:
        'Partial sections and include contacts - returns specified sections & contacts',
      includeContacts: true,
      sectionTypes: ['sectionType2'],
      expectedActivityDescriptions: [
        'Type 2, Item 3',
        'Contact 3 Helpline',
        'Type 2, Item 2',
        'Contact 2 Helpline',
        'Type 2, Item 1',
        'Contact 1 Helpline',
      ],
      expectedTotalCount: 6,
    },
    {
      description:
        'Pagination - returns correct slice of results and accurate total count',
      includeContacts: true,
      sectionTypes: ['sectionType2'],
      offset: 2,
      limit: 3,
      expectedActivityDescriptions: [
        'Type 2, Item 2',
        'Contact 2 Helpline',
        'Type 2, Item 1',
      ],
      expectedTotalCount: 6,
    },
  ];

  each(testCases).test(
    '$description',
    async ({
      sectionTypes,
      includeContacts,
      expectedActivityDescriptions,
      expectedTotalCount,
      offset,
      limit,
    }: TestCase) => {
      const response = await request
        .get(getRoutePath(sampleCase.id, sectionTypes, includeContacts, offset, limit))
        .set(headers);
      expect(response.status).toBe(200);
      const {
        count,
        activities,
      }: { count: number; activities: TimelineActivity<any>[] } = response.body;
      const activityDescriptions = activities.map(ev =>
        isCaseSectionTimelineActivity(ev)
          ? ev.activity.sectionTypeSpecificData.text
          : ev.activity.helpline,
      );
      expect(activityDescriptions).toStrictEqual(expectedActivityDescriptions);
      const activityContacts: Contact[] = activities
        .filter(ev => !isCaseSectionTimelineActivity(ev))
        .map(ev => ev.activity);
      expect(count).toBe(expectedTotalCount);
      activityContacts.forEach(ec => {
        const expectedContact = expectedContacts.find(expected => expected.id === ec.id);
        expect(ec).toStrictEqual(expectedContact);
      });
    },
  );
});
