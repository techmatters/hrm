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
import each from 'jest-each';
import { mockTransaction, mockConnection } from '../mock-db';
import * as contactDb from '../../contact/contactDataAccess';
import {
  connectContactToCase,
  createContact,
  patchContact,
  searchContacts,
} from '../../contact/contactService';

import { ContactBuilder } from './contact-builder';
import { omit } from 'lodash';
import { twilioUser } from '@tech-matters/twilio-worker-auth';
import { newOk } from '@tech-matters/types';
import * as profilesDB from '../../profile/profileDataAccess';
import * as profilesService from '../../profile/profileService';
import { NewContactRecord } from '../../contact/sql/contactInsertSql';
import { ALWAYS_CAN } from '../mocks';
import '@tech-matters/testing/expectToParseAsDate';

jest.mock('../../contact/contactDataAccess');

const getIdentifierWithProfilesSpy = jest
  .spyOn(profilesDB, 'getIdentifierWithProfiles')
  .mockImplementation(
    () => async () =>
      newOk({
        data: {
          id: 1,
          identifier: 'identifier',
          accountSid: 'accountSid',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'createdBy',
          profiles: [
            {
              id: 1,
              accountSid: 'accountSid',
              createdAt: new Date(),
              updatedAt: new Date(),
              name: 'name',
              contactsCount: 0,
              casesCount: 0,
              createdBy: 'createdBy',
            },
          ],
        },
      }),
  );

const workerSid = 'WORKER_SID';
const baselineDate = new Date(2020, 1, 1);

const mockContact: contactDb.Contact = {
  id: 1234,
  accountSid: 'accountSid',
  csamReports: [],
  referrals: [],
  conversationMedia: [],
  rawJson: {} as any,
  createdAt: baselineDate.toISOString(),
};

describe('createContact', () => {
  beforeEach(() => {
    const conn = mockConnection();
    mockTransaction(conn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const sampleCreateContactPayload: NewContactRecord = {
    rawJson: {
      childInformation: {
        firstName: 'Lorna',
        lastName: 'Ballantyne',
      },
      callType: 'carrier pigeon',
      caseInformation: {},
      categories: {
        a: ['category'],
      },
    },
    queueName: 'Q',
    conversationDuration: 100,
    twilioWorkerId: 'owning-worker-id',
    timeOfContact: new Date(2010, 5, 15).toISOString(),
    createdBy: 'ignored-worker-id',
    helpline: 'a helpline',
    taskId: 'a task',
    channel: 'morse code',
    number: "that's numberwang",
    channelSid: 'a channel',
    serviceSid: 'a service',
  };

  const spyOnContact = ({
    contactMockReturn,
  }: {
    contactMockReturn?: ReturnType<typeof contactDb.create>;
  } = {}) => {
    const createContactMock = jest.fn(
      contactMockReturn ||
        (() => Promise.resolve({ contact: mockContact, isNewRecord: true })),
    );
    jest.spyOn(contactDb, 'create').mockReturnValue(createContactMock);

    return createContactMock;
  };

  test("Passes payload down to data layer with user workerSid used for 'createdBy'", async () => {
    const createContactMock = spyOnContact();
    const returnValue = await createContact(
      'parameter account-sid',
      'contact-creator',
      sampleCreateContactPayload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith('parameter account-sid', {
      ...sampleCreateContactPayload,
      createdBy: 'contact-creator',
      profileId: 1,
      identifierId: 1,
    });

    expect(returnValue).toStrictEqual(mockContact);
  });

  test("If no identifier record exists for 'number', call createIdentifierAndProfile", async () => {
    const createContactMock = spyOnContact();

    getIdentifierWithProfilesSpy.mockImplementationOnce(
      () => async () => newOk({ data: null }),
    );

    jest.spyOn(profilesService, 'createIdentifierAndProfile').mockImplementationOnce(
      () => async () =>
        newOk({
          data: { id: 2, profiles: [{ id: 2 }] },
        }) as any,
    );

    const returnValue = await createContact(
      'parameter account-sid',
      'contact-creator',
      sampleCreateContactPayload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith('parameter account-sid', {
      ...sampleCreateContactPayload,
      createdBy: 'contact-creator',
      profileId: 2,
      identifierId: 2,
    });

    expect(returnValue).toStrictEqual(mockContact);
  });

  test('Missing values are converted to empty strings for several fields', async () => {
    const createContactMock = spyOnContact();

    const minimalPayload = omit(
      sampleCreateContactPayload,
      'helpline',
      'number',
      'channel',
      'channelSid',
      'serviceSid',
      'twilioWorkerId',
    );
    const returnValue = await createContact(
      'parameter account-sid',
      'contact-creator',
      minimalPayload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith('parameter account-sid', {
      ...minimalPayload,
      createdBy: 'contact-creator',
      helpline: '',
      number: '',
      channel: '',
      channelSid: '',
      serviceSid: '',
      twilioWorkerId: '',
      profileId: undefined,
      identifierId: undefined,
    });

    expect(returnValue).toStrictEqual(mockContact);
  });

  test('Missing timeOfContact value is substituted with current date', async () => {
    const createContactMock = spyOnContact();

    const payload = omit(sampleCreateContactPayload, 'timeOfContact');
    const returnValue = await createContact(
      'parameter account-sid',
      'contact-creator',
      payload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith('parameter account-sid', {
      ...payload,
      timeOfContact: expect.toParseAsDate(),
      createdBy: 'contact-creator',
      profileId: 1,
      identifierId: 1,
    });

    expect(returnValue).toStrictEqual(mockContact);
  });

  test('queue will be empty if not present', async () => {
    const createContactMock = spyOnContact();

    const payload = omit(sampleCreateContactPayload, 'queueName');
    const legacyPayload = omit(sampleCreateContactPayload, 'queueName');
    const returnValue = await createContact(
      'parameter account-sid',
      'contact-creator',
      legacyPayload as any,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith('parameter account-sid', {
      ...payload,
      queueName: '',
      createdBy: 'contact-creator',
      profileId: 1,
      identifierId: 1,
    });

    expect(returnValue).toStrictEqual(mockContact);
  });
});

describe('connectContactToCase', () => {
  test('Returns contact produced by data access layer', async () => {
    const connectSpy = jest.fn();
    connectSpy.mockResolvedValue(mockContact);
    jest.spyOn(contactDb, 'connectToCase').mockImplementation(() => connectSpy);
    const result = await connectContactToCase(
      'accountSid',
      'case-connector',
      '1234',
      '4321',
      ALWAYS_CAN,
    );
    expect(connectSpy).toHaveBeenCalledWith(
      'accountSid',
      '1234',
      '4321',
      'case-connector',
    );
    expect(result).toStrictEqual(mockContact);
  });

  test('Throws if data access layer returns undefined', () => {
    jest
      .spyOn(contactDb, 'connectToCase')
      .mockImplementation(() => () => Promise.resolve(undefined));
    expect(
      connectContactToCase('accountSid', 'case-connector', '1234', '4321', ALWAYS_CAN),
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
      },
      categories: {
        category: ['subCategory'],
      },
    },
  };
  test('Passes callerInformation, childInformation, caseInformation & categories to data layer as separate properties', async () => {
    const patchSpy = jest.fn();
    jest.spyOn(contactDb, 'patch').mockReturnValue(patchSpy);
    patchSpy.mockResolvedValue(mockContact);
    const result = await patchContact(
      'accountSid',
      'contact-patcher',
      true,
      '1234',
      samplePatch,
      ALWAYS_CAN,
    );
    expect(result).toStrictEqual(mockContact);
    expect(patchSpy).toHaveBeenCalledWith('accountSid', '1234', true, {
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
        category: ['subCategory'],
      },
    });
  });
  test('Throws if data layer returns undefined', () => {
    const patchSpy = jest.fn();
    jest.spyOn(contactDb, 'patch').mockReturnValue(patchSpy);
    patchSpy.mockResolvedValue(undefined);
    expect(
      patchContact(
        'accountSid',
        'contact-patcher',
        true,
        '1234',
        samplePatch,
        ALWAYS_CAN,
      ),
    ).rejects.toThrow();
  });
});

describe('searchContacts', () => {
  const accountSid = 'account-sid',
    contactSearcher = 'contact-searcher';
  test('Returns contacts returned by data layer unmodified', async () => {
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
      .withTaskId('sarah-park-task')
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
    const expectedSearchResult: { count: number; contacts: contactDb.Contact[] } = {
      count: 2,
      contacts: [jillSmith, sarahPark],
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
          canOnlyViewOwnContacts: false,
        },
      },
    );

    expect(searchSpy).toHaveBeenCalledWith(accountSid, parameters, expect.any(Number), 0);
    expect(result).toStrictEqual(expectedSearchResult);
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
    const searchSpy = jest
      .spyOn(contactDb, 'search')
      .mockResolvedValue({ count: 0, rows: [] });
    await searchContacts(
      accountSid,
      body,
      {},
      {
        can: () => true,
        user: twilioUser(workerSid, []),
        searchPermissions: {
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
    const searchSpy = jest
      .spyOn(contactDb, 'search')
      .mockResolvedValue({ count: 0, rows: [] });
    await searchContacts(
      accountSid,
      body,
      { limit: 10, offset: 1000 },
      {
        can: () => true,
        user: twilioUser(workerSid, []),
        searchPermissions: {
          canOnlyViewOwnContacts: false,
        },
      },
    );

    expect(searchSpy).toHaveBeenCalledWith(accountSid, body, 10, 1000);
  });
});

describe('search contacts permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  each([
    {
      description: 'Supervisor can view others contacts',
      isSupervisor: true,
      canOnlyViewOwnContacts: false,
      counselorSearchParam: 'any-worker-sid',
      overriddenCounselorSearchParam: 'any-worker-sid',
      shouldCallSearch: true,
    },
    {
      description: 'Agent can view others contacts',
      isSupervisor: false,
      canOnlyViewOwnContacts: false,
      counselorSearchParam: 'any-worker-sid',
      overriddenCounselorSearchParam: 'any-worker-sid',
      shouldCallSearch: true,
    },
    {
      description: 'Agent cannot view others contacts',
      isSupervisor: false,
      canOnlyViewOwnContacts: true,
      counselorSearchParam: 'any-worker-sid',
      shouldCallSearch: false,
    },
    {
      description: 'Agent can view own contacts',
      isSupervisor: false,
      canOnlyViewOwnContacts: true,
      counselorSearchParam: workerSid,
      overriddenCounselorSearchParam: workerSid,
      shouldCallSearch: true,
    },
    {
      description: 'Agent defaults to own contacts when no counselor specified',
      isSupervisor: false,
      canOnlyViewOwnContacts: true,
      counselorSearchParam: undefined,
      overriddenCounselorSearchParam: workerSid,
      shouldCallSearch: true,
    },
  ]).test(
    '$description',
    async ({
      isSupervisor,
      canOnlyViewOwnContacts,
      counselorSearchParam,
      overriddenCounselorSearchParam,
      shouldCallSearch,
    }) => {
      const accountSid = 'account-sid';
      const body = {
        helpline: 'helpline',
        onlyDataContacts: true,
        counselor: counselorSearchParam,
      };
      const limitOffset = { limit: 10, offset: 0 };
      const can = () => true;
      const roles = [];
      const user = { ...twilioUser(workerSid, roles), isSupervisor: isSupervisor };
      const searchPermissions = {
        canOnlyViewOwnContacts,
      };
      const reqData = {
        can,
        user,
        searchPermissions,
      };

      const searchSpy = jest
        .spyOn(contactDb, 'search')
        .mockResolvedValue({ count: 0, rows: [] });
      await searchContacts(accountSid, body, limitOffset, reqData);

      if (shouldCallSearch) {
        const overridenBody = { ...body, counselor: overriddenCounselorSearchParam };
        expect(searchSpy).toHaveBeenCalledWith(accountSid, overridenBody, 10, 0);
      } else {
        expect(searchSpy).not.toHaveBeenCalled();
      }
    },
  );
});
