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
import { mockTransaction, mockConnection } from '../mock-db';
import * as contactDb from '../../src/contact/contact-data-access';
import * as referralDb from '../../src/referral/referral-data-access';
import {
  connectContactToCase,
  createContact,
  patchContact,
  SearchContact,
  searchContacts,
} from '../../src/contact/contact';

import { ContactBuilder } from './contact-builder';
import { omit } from 'lodash';
import { CSAMReport } from '../../src/csam-report/csam-report';
import { twilioUser } from '@tech-matters/twilio-worker-auth';
import { subHours } from 'date-fns';
jest.mock('../../src/contact/contact-data-access');
jest.mock('../../src/referral/referral-data-access');

const workerSid = 'WORKER_SID';

const mockContact: contactDb.Contact = {
  id: 1234,
  accountSid: 'accountSid',
  csamReports: [],
};

describe('createContact', () => {
  beforeEach(() => {
    const conn = mockConnection();
    mockTransaction(conn);
  });

  const sampleCreateContactPayload = {
    rawJson: {
      childInformation: {
        firstName: 'Lorna',
        lastName: 'Ballantyne',
      },
      callType: 'carrier pigeon',
      caseInformation: {
        categories: {
          a: {
            category: true,
          },
        },
      },
    },
    queueName: 'Q',
    conversationDuration: 100,
    twilioWorkerId: 'owning-worker-id',
    timeOfContact: new Date(2010, 5, 15),
    createdBy: 'ignored-worker-id',
    helpline: 'a helpline',
    taskId: 'a task',
    channel: 'morse code',
    number: "that's numberwang",
    channelSid: 'a channel',
    serviceSid: 'a service',
    csamReports: [],
  };
  test("Passes payload down to data layer with user workerSid used for 'createdBy'", async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const returnValue = await createContact(
      'parameter account-sid',
      'contact-creator',
      sampleCreateContactPayload,
      {
        can: () => true,
        user: twilioUser(workerSid, []),
      },
    );
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...sampleCreateContactPayload, createdBy: 'contact-creator' },
      [],
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('Missing values are converted to empty strings for several fields', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const minimalPayload = omit(
      sampleCreateContactPayload,
      'helpline',
      'number',
      'channel',
      'channelSid',
      'serviceSid',
      'taskId',
      'twilioWorkerId',
    );
    const returnValue = await createContact(
      'parameter account-sid',
      'contact-creator',
      minimalPayload,
      {
        can: () => true,
        user: twilioUser(workerSid, []),
      },
    );
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      {
        ...minimalPayload,
        createdBy: 'contact-creator',
        helpline: '',
        number: '',
        channel: '',
        channelSid: '',
        serviceSid: '',
        taskId: '',
        twilioWorkerId: '',
      },
      [],
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('Missing timeOfContact value is substituted with current date', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = omit(sampleCreateContactPayload, 'timeOfContact');
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      {
        ...payload,
        timeOfContact: expect.any(Date),
        createdBy: 'contact-creator',
      },
      [],
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });

  test('rawJson will be read from form property if it is there and rawJson is not', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = {
      ...omit(sampleCreateContactPayload, 'rawJson'),
      form: sampleCreateContactPayload.rawJson,
    };
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...sampleCreateContactPayload, createdBy: 'contact-creator' },
      [],
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('empty array will be passed for csamReportIds if csamReport property is missing', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = omit(sampleCreateContactPayload, 'csamReport');
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, createdBy: 'contact-creator' },
      [],
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('ids will be passed in csamReportIds if csamReport property is populated', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = {
      ...sampleCreateContactPayload,
      // Cheat a bit and cast these because all the other props on CSAMReportEntry are ignored here
      csamReports: <CSAMReport[]>[{ id: 2 }, { id: 4 }, { id: 6 }],
    };
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, createdBy: 'contact-creator' },
      expect.arrayContaining([2, 4, 6]),
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('referrals will be passed if populated', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = {
      ...sampleCreateContactPayload,
      // Cheat a bit and cast these because all the other props on CSAMReportEntry are ignored here
      referrals: <referralDb.Referral[]>[
        { contactId: '1234', referredAt: new Date().toISOString(), resourceId: 'TEST_RESOURCE_ID' },
      ],
    };
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, createdBy: 'contact-creator' },
      [],
      expect.arrayContaining(payload.referrals),
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  // test('queue will be looked for as a rawJson property if omitted from the top level', async () => {
  //   const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
  //   const payload = {
  //     ...omit(sampleCreateContactPayload, 'queueName'),
  //     rawJson: {
  //       ...sampleCreateContactPayload.rawJson,
  //       queueName: 'Q2',
  //     },
  //   };
  //   const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
  //     can: () => true,
  //     user: twilioUser(workerSid, []),
  //   });
  //   expect(createSpy).toHaveBeenCalledWith(
  //     'parameter account-sid',
  //     { ...payload, queueName: 'Q2', createdBy: 'contact-creator' },
  //     [],
  //     [],
  //   );
  //   expect(returnValue).toStrictEqual(mockContact);
  // });
  // test('queue will be looked for as a form property if omitted from the top level and rawJson', async () => {
  //   const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
  //   const payload = {
  //     ...omit(sampleCreateContactPayload, 'rawJson', 'queueName'),
  //     rawJson: {
  //       ...sampleCreateContactPayload.rawJson,
  //       queueName: 'Q2',
  //     },
  //     form: sampleCreateContactPayload.rawJson,
  //   };
  //   const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
  //     can: () => true,
  //     user: twilioUser(workerSid, []),
  //   });
  //   expect(createSpy).toHaveBeenCalledWith(
  //     'parameter account-sid',
  //     { ...payload, queueName: 'Q2', createdBy: 'contact-creator' },
  //     [],
  //     [],
  //   );
  //   expect(returnValue).toStrictEqual(mockContact);
  // });
  // test('queue will be undefined if not present on rawJson, form or top level', async () => {
  //   const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
  //   const payload = omit(sampleCreateContactPayload, 'queueName');
  //   const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
  //     can: () => true,
  //     user: twilioUser(workerSid, []),
  //   });
  //   expect(createSpy).toHaveBeenCalledWith(
  //     'parameter account-sid',
  //     { ...payload, queueName: undefined, createdBy: 'contact-creator' },
  //     [],
  //     [],
  //   );
  //   expect(returnValue).toStrictEqual(mockContact);
  // });
  test('referrals specified - these will be added to the database using the created contact ID', async () => {
    const hourAgo = subHours(new Date(), 1);
    const payload = {
      ...sampleCreateContactPayload,
      referrals: [
        {
          resourceId: 'TEST_RESOURCE_1',
          referredAt: hourAgo.toISOString(),
          resourceName: 'A test referred resource',
        },
        {
          resourceId: 'TEST_RESOURCE_2',
          referredAt: hourAgo.toISOString(),
          resourceName: 'Another test referred resource',
        },
      ],
    };

    const createSpy = jest
      .spyOn(contactDb, 'create')
      .mockResolvedValue({ ...mockContact, id: 1234, referrals: payload.referrals });

    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...sampleCreateContactPayload, createdBy: 'contact-creator' },
      [],
      [],
    );

    expect(returnValue).toStrictEqual({
      ...mockContact,
      // Dumb mock always returns same referral regardless of what's passed in
      referrals: [
        {
          resourceId: 'TEST_RESOURCE_1',
          referredAt: hourAgo.toISOString(),
          resourceName: 'A test referred resource',
        },
        {
          resourceId: 'TEST_RESOURCE_2',
          referredAt: hourAgo.toISOString(),
          resourceName: 'Another test referred resource',
        },
      ],
    });
  });
});

describe('connectContactToCase', () => {
  test('Returns contact produced by data access layer', async () => {
    const connectSpy = jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(mockContact);
    const result = await connectContactToCase('accountSid', 'case-connector', '1234', '4321', {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(connectSpy).toHaveBeenCalledWith('accountSid', '1234', '4321');
    expect(result).toStrictEqual(mockContact);
  });
  test('Throws if data access layer returns undefined', () => {
    jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(undefined);
    expect(
      connectContactToCase('accountSid', 'case-connector', '1234', '4321', {
        can: () => true,
        user: twilioUser(workerSid, []),
      }),
    ).rejects.toThrow();
  });
});

describe('patchContact', () => {
  const samplePatch = {
    rawJson: {
      childInformation: {
        firstName: 'Charlotte',
        lastName: 'Ballantyne',
      },
      callerInformation: {
        firstName: 'Lorna',
        lastName: 'Ballantyne',
      },
      caseInformation: {
        some: 'property',
        categories: {
          category: { subCategory: true },
        },
      },
    },
  };
  test('Passes callerInformation, childInformation, caseInformation & categories to data layer as separate properties', async () => {
    const patchSpy = jest.spyOn(contactDb, 'patch').mockResolvedValue(mockContact);
    const result = await patchContact('accountSid', 'contact-patcher', '1234', samplePatch, {
      can: () => true,
      user: twilioUser(workerSid, []),
    });
    expect(result).toStrictEqual(mockContact);
    expect(patchSpy).toHaveBeenCalledWith('accountSid', '1234', {
      updatedBy: 'contact-patcher',
      childInformation: {
        firstName: 'Charlotte',
        lastName: 'Ballantyne',
      },
      callerInformation: {
        firstName: 'Lorna',
        lastName: 'Ballantyne',
      },
      caseInformation: {
        some: 'property',
      },
      categories: {
        category: { subCategory: true },
      },
    });
  });
  test('Throws if data layer returns undefined', () => {
    jest.spyOn(contactDb, 'patch').mockResolvedValue(undefined);
    expect(
      patchContact('accountSid', 'contact-patcher', '1234', samplePatch, {
        can: () => true,
        user: twilioUser(workerSid, []),
      }),
    ).rejects.toThrow();
  });
});

describe('searchContacts', () => {
  const accountSid = 'account-sid',
    contactSearcher = 'contact-searcher';
  test('Converts contacts returned by data layer to search results', async () => {
    const jillSmith = new ContactBuilder()
      .withId(4321)
      .withHelpline('a helpline')
      .withTaskId('jill-smith-task')
      .withChildFirstName('Jill')
      .withChildLastName('Smith')
      .withCallSummary('Lost young boy')
      .withNumber('+12025550142')
      .withCallType('Child calling about self')
      .withTwilioWorkerId('twilio-worker-id')
      .withCreatedBy(contactSearcher)
      .withCreatedAt(new Date('2020-03-10T00:00:00Z'))
      .withTimeOfContact(new Date('2020-03-10T00:00:00Z'))
      .withChannel('voice')
      .withConversationDuration(10)
      .build();
    const sarahPark = new ContactBuilder()
      .withId(1234)
      .withChildFirstName('Sarah')
      .withChildLastName('Park')
      .withCallSummary('Young pregnant woman')
      .withNumber('Anonymous')
      .withCallType('Child calling about self')
      .withTwilioWorkerId('twilio-worker-id')
      .withCreatedBy(contactSearcher)
      .withCreatedAt(new Date('2020-03-15T00:00:00Z'))
      .withTimeOfContact(new Date('2020-03-15T00:00:00Z'))
      .build();
    const expectedSearchResult: { count: number; contacts: SearchContact[] } = {
      count: 2,
      contacts: [
        {
          contactId: '4321',
          overview: {
            helpline: 'a helpline',
            dateTime: '2020-03-10T00:00:00.000Z',
            name: '', // Legacy property, not used in Flex v2.1+
            customerNumber: '+12025550142',
            createdBy: 'contact-searcher',
            callType: 'Child calling about self',
            categories: {},
            counselor: 'twilio-worker-id',
            notes: 'Lost young boy',
            channel: 'voice',
            conversationDuration: 10,
            taskId: 'jill-smith-task',
          },
          details: jillSmith.rawJson,
          csamReports: [],
          referrals: [],
        },
        {
          contactId: '1234',
          overview: {
            helpline: undefined,
            taskId: undefined,
            dateTime: '2020-03-15T00:00:00.000Z',
            name: '', // Legacy property, not used in Flex v2.1+
            customerNumber: 'Anonymous',
            createdBy: 'contact-searcher',
            callType: 'Child calling about self',
            categories: {},
            counselor: 'twilio-worker-id',
            notes: 'Young pregnant woman',
            channel: '',
            conversationDuration: null,
          },
          details: sarahPark.rawJson,
          csamReports: [],
          referrals: [],
        },
      ],
    };

    const mockedResult = {
      count: 2,
      rows: [jillSmith, sarahPark],
    };
    const searchSpy = jest.spyOn(contactDb, 'search').mockResolvedValue(mockedResult);
    const parameters = { helpline: 'helpline', onlyDataContacts: false };

    const result = await searchContacts(
      accountSid,
      parameters,
      {},
      {
        can: () => true,
        user: twilioUser(workerSid, []),
        searchPermissions: {
          canOnlyViewOwnCases: false,
          canOnlyViewOwnContacts: false,
        },
      },
    );

    expect(searchSpy).toHaveBeenCalledWith(accountSid, parameters, expect.any(Number), 0);
    expect(result).toStrictEqual(expectedSearchResult);
  });
  // Test for legacy behaviour, will be removed
  test('Populates name overview property for legacy contacts', async () => {
    const jillSmith = new ContactBuilder()
      .withId(4321)
      .withHelpline('a helpline')
      .withTaskId('jill-smith-task')
      .withCallSummary('Lost young boy')
      .withNumber('+12025550142')
      .withCallType('Child calling about self')
      .withTwilioWorkerId('twilio-worker-id')
      .withCreatedBy(contactSearcher)
      .withCreatedAt(new Date('2020-03-10T00:00:00Z'))
      .withTimeOfContact(new Date('2020-03-10T00:00:00Z'))
      .withChannel('voice')
      .withConversationDuration(10)
      .build();
    jillSmith.rawJson.childInformation.name = {
      firstName: 'Jill',
      lastName: 'Smith',
    };

    const mockedResult = {
      count: 1,
      rows: [jillSmith],
    };
    jest.spyOn(contactDb, 'search').mockResolvedValue(mockedResult);
    const parameters = { helpline: 'helpline', onlyDataContacts: false };

    const result = await searchContacts(
      accountSid,
      parameters,
      {},
      {
        can: () => true,
        user: twilioUser(workerSid, []),
        searchPermissions: {
          canOnlyViewOwnCases: false,
          canOnlyViewOwnContacts: false,
        },
      },
    );
    expect(result.contacts[0].overview.name).toStrictEqual('Jill Smith');
  });

  test('Call search without limit / offset, a default limit and offset 0', async () => {
    const body = {
      helpline: 'helpline',
      firstName: 'Jill',
      lastName: 'Smith',
      counselor: 'counselorId',
      phoneNumber: '123',
      dateFrom: '2020-03-10',
      dateTo: '2020-03-15',
      contactNumber: '+123456',
      onlyDataContacts: true,
    };
    const searchSpy = jest.spyOn(contactDb, 'search').mockResolvedValue({ count: 0, rows: [] });
    await searchContacts(
      accountSid,
      body,
      {},
      {
        can: () => true,
        user: twilioUser(workerSid, []),
        searchPermissions: {
          canOnlyViewOwnCases: false,
          canOnlyViewOwnContacts: false,
        },
      },
    );

    expect(searchSpy).toHaveBeenCalledWith(accountSid, body, expect.any(Number), 0);
  });

  test('Call search without limit / offset, a default limit and offset 0', async () => {
    const body = {
      helpline: 'helpline',
      onlyDataContacts: true,
    };
    const searchSpy = jest.spyOn(contactDb, 'search').mockResolvedValue({ count: 0, rows: [] });
    await searchContacts(
      accountSid,
      body,
      { limit: 10, offset: 1000 },
      {
        can: () => true,
        user: twilioUser(workerSid, []),
        searchPermissions: {
          canOnlyViewOwnCases: false,
          canOnlyViewOwnContacts: false,
        },
      },
    );

    expect(searchSpy).toHaveBeenCalledWith(accountSid, body, 10, 1000);
  });
});
