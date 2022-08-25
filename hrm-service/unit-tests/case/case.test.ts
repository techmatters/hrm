import * as caseDb from '../../src/case/case-data-access';
import * as caseApi from '../../src/case/case';
import { createMockCase, createMockCaseRecord } from './mock-cases';
import each from 'jest-each';
import { CaseRecord, NewCaseRecord } from '../../src/case/case-data-access';
import '../../service-tests/case-validation';

jest.mock('../../src/case/case-data-access');
const accountSid = 'account-sid';
const workerSid = 'worker-sid';
const baselineCreatedDate = new Date(2013, 6, 13).toISOString();

test('create case', async () => {
  const caseToBeCreated = createMockCase({
    helpline: 'helpline',
    status: 'open',
    info: {
      counsellorNotes: [
        {
          note: 'Child with covid-19',
          twilioWorkerId: workerSid,
          createdAt: baselineCreatedDate,
        },
      ],
    },
    twilioWorkerId: 'client-assigned-twilio-worker-id',
    createdBy: 'Fake news', // Overwritten by workerSid for User
    accountSid: 'wrong-account-sid', // Overwritten by accountSid for User
  });
  const expectedCaseDbParameter: NewCaseRecord = {
    ...caseToBeCreated,
    accountSid,
    createdBy: workerSid,
    createdAt: expect.any(String), // current timestamp
    updatedAt: expect.any(String), // current timestamp
    info: {
      counsellorNotes: [
        {
          note: 'Child with covid-19',
          twilioWorkerId: workerSid,
          createdAt: baselineCreatedDate,
        },
      ],
    },
    caseSections: [
      {
        accountSid: undefined,
        sectionType: 'note',
        caseId: undefined,
        createdBy: workerSid,
        updatedAt: undefined,
        updatedBy: undefined,
        createdAt: expect.any(String),
        sectionId: expect.any(String),
        sectionTypeSpecificData: { note: 'Child with covid-19' },
      },
    ],
  };
  // @ts-ignore
  delete expectedCaseDbParameter.id;
  const createdCaseRecord: CaseRecord = {
    ...expectedCaseDbParameter,
    id: 1,
    accountSid,
    caseSections: [
      {
        accountSid,
        sectionType: 'note',
        caseId: 1,
        createdBy: workerSid,
        createdAt: baselineCreatedDate,
        sectionId: 'WOULD BE SAME AS INPUT',
        sectionTypeSpecificData: { note: 'Child with covid-19' },
      },
    ],
  };
  const createSpy = jest.spyOn(caseDb, 'create').mockResolvedValue(createdCaseRecord);

  const createdCase = await caseApi.createCase(caseToBeCreated, accountSid, workerSid);
  // any worker & account specified on the object should be overwritten with the ones from the user
  expect(createSpy).toHaveBeenCalledWith(expectedCaseDbParameter, accountSid);
  expect(createdCase).toStrictEqual({
    ...caseToBeCreated,
    id: 1,
    childName: '',
    categories: {},
    createdBy: workerSid,
    accountSid,
    info: {
      ...caseToBeCreated.info,
      counsellorNotes: [
        {
          accountSid,
          note: 'Child with covid-19',
          twilioWorkerId: workerSid,
          createdAt: baselineCreatedDate,
          id: 'WOULD BE SAME AS INPUT',
        },
      ],
    },
  });
});

describe('searchCases', () => {
  const caseId = 1;
  const caseWithContact = createMockCase({
    id: caseId,
    helpline: 'helpline',
    accountSid,
    status: 'open',
    info: {
      counsellorNotes: [
        {
          accountSid,
          note: 'Child with covid-19',
          twilioWorkerId: 'contact-adder',
          id: 'NOTE_1',
          createdAt: baselineCreatedDate,
        },
      ],
    },
    twilioWorkerId: 'twilio-worker-id',
    connectedContacts: [
      {
        id: 1,
        accountSid,
        csamReports: [],
        rawJson: {
          childInformation: { name: { firstName: 'name', lastName: 'last' } },
          caseInformation: {
            categories: {
              cat1: { sub1: false, sub2: true },
              cat2: { sub2: false, sub4: false },
            },
          },
          callerInformation: { name: { firstName: undefined, lastName: undefined } },
          callType: '',
        },
      },
    ],
  });
  const caseRecordWithContact = createMockCaseRecord({
    accountSid,
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: {},
    caseSections: [
      {
        accountSid,
        sectionTypeSpecificData: { note: 'Child with covid-19' },
        createdBy: 'contact-adder',
        createdAt: baselineCreatedDate,
        caseId,
        sectionType: 'note',
        sectionId: 'NOTE_1',
      },
    ],
    twilioWorkerId: 'twilio-worker-id',
    connectedContacts: [
      {
        id: 1,
        accountSid,
        csamReports: [],
        rawJson: {
          childInformation: { name: { firstName: 'name', lastName: 'last' } },
          caseInformation: {
            categories: {
              cat1: { sub1: false, sub2: true },
              cat2: { sub2: false, sub4: false },
            },
          },
          callerInformation: { name: { firstName: undefined, lastName: undefined } },
          callType: '',
        },
      },
    ],
  });

  const caseWithoutContact = createMockCase({
    accountSid,
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: {
      counsellorNotes: [
        {
          accountSid,
          note: 'Child with covid-19',
          twilioWorkerId: 'contact-adder',
          id: 'NOTE_1',
          createdAt: baselineCreatedDate,
        },
      ],
    },
    twilioWorkerId: 'twilio-worker-id',
    connectedContacts: [],
  });

  const caseRecordWithoutContact = createMockCaseRecord({
    id: caseId,
    accountSid,
    helpline: 'helpline',
    status: 'open',
    caseSections: [
      {
        accountSid,
        sectionTypeSpecificData: { note: 'Child with covid-19' },
        createdBy: 'contact-adder',
        createdAt: baselineCreatedDate,
        caseId,
        sectionType: 'note',
        sectionId: 'NOTE_1',
      },
    ],
    twilioWorkerId: 'twilio-worker-id',
    connectedContacts: [],
  });

  each([
    {
      description:
        'list cases (with 1st contact, no limit/offset) - extracts child name and categories',
      search: { helpline: 'helpline' },
      expectedDbFilters: { helplines: ['helpline'] },
      casesFromDb: [caseRecordWithContact],
      expectedCases: [
        {
          ...caseWithContact,
          childName: 'name last',
          categories: { cat1: ['sub2'] },
        },
      ],
    },
    {
      description:
        'list cases (with 1st contact, with limit/offset) - extracts child name and categories',
      search: { helpline: 'helpline' },
      expectedDbFilters: { helplines: ['helpline'] },
      listConfig: { offset: 30, limit: 45 },
      casesFromDb: [caseRecordWithContact],
      expectedCases: [
        {
          ...caseWithContact,
          childName: 'name last',
          categories: { cat1: ['sub2'] },
        },
      ],
    },
    {
      description:
        'list cases (without contacts) - extracts child name and categories & creates legacy notes',
      search: { helpline: 'helpline' },
      expectedDbFilters: { helplines: ['helpline'] },
      casesFromDb: [caseRecordWithoutContact],
      expectedCases: [{ ...caseWithoutContact, childName: '', categories: {} }],
    },
    {
      description: 'list cases without helpline - sends offset & limit to db layer but no helpline',
      listConfig: { offset: 30, limit: 45 },
      casesFromDb: [caseRecordWithoutContact],
      expectedCases: [{ ...caseWithoutContact, childName: '', categories: {} }],
    },
  ]).test(
    '$description',
    async ({
      casesFromDb,
      expectedCases,
      listConfig,
      search,
      expectedDbSearchCriteria = {},
      expectedDbFilters = {},
    }) => {
      const expected = { cases: expectedCases, count: 1337 };

      const searchSpy = jest
        .spyOn(caseDb, 'search')
        .mockResolvedValue({ cases: casesFromDb, count: 1337 });

      const result = await caseApi.searchCases(accountSid, listConfig, search);

      expect(searchSpy).toHaveBeenCalledWith(
        listConfig ?? {},
        accountSid,
        expectedDbSearchCriteria,
        {
          includeOrphans: true,
          excludedStatuses: [],
          counsellors: undefined,
          ...expectedDbFilters,
        },
      );
      expect(result).toStrictEqual(expected);
    },
  );
});

describe('update existing case', () => {
  const caseId = 1;

  each([
    {
      description: 'counsellorNotes are updated using current format',
      updateCaseObject: {
        info: {
          counsellorNotes: [
            { note: 'Refugee Child', twilioWorkerId: 'contact-updater', custom: 'data' },
          ],
        },
      },
      dbResponse: {
        caseSections: [
          {
            caseId: 1,
            createdBy: 'contact-updater',
            createdAt: expect.toParseAsDate(),
            sectionId: expect.anything(),
            sectionType: 'note',
            sectionTypeSpecificData: {
              note: 'Refugee Child',
              custom: 'data',
            },
          },
        ],
        accountSid,
        id: 1,
        twilioWorkerId: workerSid,
      },
      expectedResponse: createMockCase({
        accountSid,
        info: {
          counsellorNotes: [
            {
              note: 'Refugee Child',
              custom: 'data',
              twilioWorkerId: 'contact-updater',
              id: expect.anything(),
              createdAt: expect.toParseAsDate(),
            },
          ],
        },
        twilioWorkerId: workerSid,
      }),
      expectedDbCaseParameter: {
        caseSections: [
          {
            caseId: 1,
            createdBy: 'contact-updater',
            createdAt: expect.toParseAsDate(),
            updatedAt: undefined,
            updatedBy: undefined,
            sectionId: expect.anything(),
            sectionType: 'note',
            sectionTypeSpecificData: {
              note: 'Refugee Child',
              custom: 'data',
            },
          },
        ],
        accountSid,
        id: 1,
        info: {
          counsellorNotes: [
            { note: 'Refugee Child', twilioWorkerId: 'contact-updater', custom: 'data' },
          ],
        },
        updatedBy: workerSid,
        updatedAt: expect.toParseAsDate(),
      },
    },
  ]).test(
    '$description',
    async ({
      updateCaseObject,
      existingCaseObject = createMockCaseRecord({}),
      dbResponse,
      expectedResponse,
      expectedDbCaseParameter = updateCaseObject,
    }) => {
      jest.clearAllMocks();
      const updateSpy = jest
        .spyOn(caseDb, 'update')
        .mockImplementation(() => Promise.resolve(createMockCaseRecord(dbResponse)));
      jest.spyOn(caseDb, 'getById').mockResolvedValue(existingCaseObject);

      const returned = await caseApi.updateCase(caseId, updateCaseObject, accountSid, workerSid);
      expect(updateSpy).toHaveBeenCalledWith(caseId, expectedDbCaseParameter, accountSid);
      expect(returned).toStrictEqual(expectedResponse);
    },
  );
});

test('update non existing case', async () => {
  const nonExistingCaseId = 1;
  jest.spyOn(caseDb, 'update').mockImplementation(() => null);

  const updateCaseObject = {
    info: {
      counsellorNotes: [
        {
          note: 'Child with covid-19',
          twilioWorkerId: workerSid,
          createdAt: baselineCreatedDate,
        },
      ],
    },
  };

  await expect(
    caseApi.updateCase(nonExistingCaseId, updateCaseObject, accountSid, workerSid),
  ).rejects.toThrow();
});
