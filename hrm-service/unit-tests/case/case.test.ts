import * as caseDb from '../../src/case/case-data-access';
import * as caseApi from '../../src/case/case';
import { createMockCaseRecord } from './mock-cases';
import each from 'jest-each';
import { mockTransaction } from '../mock-pgpromise';

jest.mock('../../src/case/case-data-access');
const accountSid = 'account-sid';
const workerSid = 'worker-sid';

test('create case', async () => {

  const caseToBeCreated = createMockCaseRecord({
    helpline: 'helpline',
    status: 'open',
    info: { notes: 'Child with covid-19' },
    twilioWorkerId: 'twilio-worker-id',
    createdBy: workerSid,
    accountSid,
  });
  const expectedCreatedCase = { ...caseToBeCreated, id: 1 }
  const createSpy = jest.spyOn(caseDb, 'create').mockResolvedValue({ ...caseToBeCreated, id: 1 });

  const createdCase = await caseApi.createCase(caseToBeCreated, accountSid, workerSid);

  expect(createSpy).toHaveBeenCalledWith(caseToBeCreated, accountSid, workerSid);
  expect(createdCase).toStrictEqual(expectedCreatedCase)
});
describe('listCases', ()=> {
  const caseId = 1;
  const caseWithContact = createMockCaseRecord({
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: {
      counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-adder' }],
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
        },
      },
    ],
  });

  const caseWithoutContact = createMockCaseRecord({
    id: caseId,
    helpline: 'helpline',
    status: 'open',
    info: { notes: 'Child with covid-19' },
    twilioWorkerId: 'twilio-worker-id',
    connectedContacts: []
  })

  each([
    {
      description: 'list cases (with 1st contact, no limit/offset) - extracts child name and categories',
      queryParams: { helpline: 'helpline' },
      casesFromDb: [caseWithContact],
      expectedCases: [{
        ...caseWithContact,
        info: {
          ...caseWithContact.info,
          notes: ['Child with covid-19'], // Legacy notes property
        },
        childName: 'name last',
        categories: { cat1: ['sub2'] },
      },
      ]
    },
    {
      description: 'list cases (with 1st contact, with limit/offset) - extracts child name and categories',
      queryParams: { helpline: 'helpline', offset: 30, limit: 45},
      casesFromDb: [caseWithContact],
      expectedCases: [{
        ...caseWithContact,
        info: {
          ...caseWithContact.info,
          notes: ['Child with covid-19'], // Legacy notes property
        },
        childName: 'name last',
        categories: { cat1: ['sub2'] },
      }]},
        {
          description: 'list cases (without contacts) - extracts child name and categories & creates legacy notes',
          queryParams: { helpline: 'helpline' },
          casesFromDb: [caseWithoutContact],
          expectedCases: [
            { ...caseWithoutContact, childName: '', categories: {} }

      ]
    },
    {
      description: 'list cases without helpline - sends offset & limit to db layer but no helpline',
      queryParams: { offset: 30, limit: 45 },
      casesFromDb: [caseWithoutContact],
      expectedCases: [
        { ...caseWithoutContact, childName: '', categories: {} }

      ]
    }])
    .test('$description', async ({ casesFromDb, expectedCases, queryParams }) => {

    const expected = { cases: expectedCases, count: 1337 };

    const listSpy = jest.spyOn(caseDb, 'list').mockResolvedValue({ cases: casesFromDb, count: 1337 });

    const result = await caseApi.listCases(queryParams, accountSid);

    expect(listSpy).toHaveBeenCalledWith(queryParams, accountSid);
    expect(result).toStrictEqual(expected);
  });
})

describe('update existing case', () => {
  const caseId = 1;
  const baselineDate = new Date(2001, 5, 4).toISOString()

  each([
    {
      description: 'counsellorNotes are updated using current format',
      updateCaseObject: {
        info: {
          counsellorNotes: [{ note: 'Refugee Child', twilioWorkerId: 'contact-updater' }],
        },
      },
      expectedResponse: createMockCaseRecord({
        info: {
          counsellorNotes: [{ note: 'Refugee Child', twilioWorkerId: 'contact-updater' }],
          notes: ['Refugee Child'],
        },
      })
    },
    {
      description: 'adding a note in legacy note format - converts legacy note to counsellor note',
      updateCaseObject: {
        info: {
          notes: ['Child with covid-19', 'Refugee Child'],
        },
      },
      existingCaseObject: createMockCaseRecord({
        info: {
          counsellorNotes: [{
            note: 'Child with covid-19',
            twilioWorkerId: 'contact-updater',
            createdAt: baselineDate
          }],
        }
      }),
      expectedDbCaseParameter: {
        info: {
          counsellorNotes: [
            { note: 'Child with covid-19', twilioWorkerId: 'contact-updater', createdAt: baselineDate },
            { note: 'Refugee Child', twilioWorkerId: workerSid, createdAt: expect.anything() }],
        }
      },
      expectedResponse: createMockCaseRecord({
        info: {
          counsellorNotes: [{ note: 'Child with covid-19', twilioWorkerId: 'contact-updater', createdAt: baselineDate },
            { note: 'Refugee Child', twilioWorkerId: workerSid, createdAt: expect.anything() }],
          notes: ['Child with covid-19', 'Refugee Child'],
        },
      })
    },
    {
      description: 'adding a referral in legacy format generates missing properties',
      existingCaseObject: createMockCaseRecord({
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
          ],
        }
      }),
      updateCaseObject: {
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'changed comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
            {
              date: '2020-10-16',
              referredTo: 'State Agency 2',
              comments: 'comment',
            },
          ],
        },
      },
      expectedDbCaseParameter: {
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'changed comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
            {
              date: '2020-10-16',
              referredTo: 'State Agency 2',
              comments: 'comment',
              createdAt: expect.anything(),
              twilioWorkerId: workerSid
            },
          ],
        },
      },
      expectedResponse: createMockCaseRecord({
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'changed comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
            {
              date: '2020-10-16',
              referredTo: 'State Agency 2',
              comments: 'comment',
              createdAt: expect.anything(),
              twilioWorkerId: workerSid
            },
          ],
        },
      })
    },
    {
      description: 'update an existing referral in legacy referral format - does not overwrite preexisting new properties',
      existingCaseObject: createMockCaseRecord({
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
          ],
        }
      }),
      updateCaseObject: {
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'changed comment',
            },
            {
              date: '2020-10-16',
              referredTo: 'State Agency 2',
              comments: 'comment',
            }
          ],
        },
      },
      expectedDbCaseParameter: {
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'changed comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
            {
              date: '2020-10-16',
              referredTo: 'State Agency 2',
              comments: 'comment',
              createdAt: expect.anything(),
              twilioWorkerId: workerSid
            },
          ],
        },
      },
      expectedResponse: createMockCaseRecord({
        info: {
          referrals: [
            {
              date: '2020-10-15',
              referredTo: 'State Agency 1',
              comments: 'changed comment',
              createdAt: '2020-10-16 00:00:00',
              twilioWorkerId: 'referral-adder',
            },
            {
              date: '2020-10-16',
              referredTo: 'State Agency 2',
              comments: 'comment',
              createdAt: expect.anything(),
              twilioWorkerId: workerSid
            },
          ],
        },
      })
    }
  ])
    .test('$description', async ({
                                   updateCaseObject,
                                   existingCaseObject = createMockCaseRecord({}),
                                   expectedResponse,
                                   expectedDbCaseParameter = updateCaseObject
                                 }) => {

      const updateSpy = jest.spyOn(caseDb, 'update').mockResolvedValue(createMockCaseRecord(expectedDbCaseParameter));
      jest.spyOn(caseDb, 'getById').mockResolvedValue(existingCaseObject);

      const returned = await caseApi.updateCase(
        caseId,
        updateCaseObject,
        accountSid,
        workerSid,
      );
      expect(updateSpy).toHaveBeenCalledWith(
        caseId,
        expectedDbCaseParameter,
        accountSid,
        workerSid,
      );
      expect(returned).toStrictEqual(expectedResponse);
    });
});

test('update non existing case', async () => {
  const nonExistingCaseId = 1;
  jest.spyOn(caseDb, 'update').mockImplementation(() => null);

  const updateCaseObject = {
    info: { notes: 'Refugee Child' },
  };

  await expect(
    caseApi.updateCase(nonExistingCaseId, updateCaseObject, accountSid, workerSid),
  ).rejects.toThrow();
});