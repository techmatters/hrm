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
import { mockTransaction, mockConnection } from '../mockDb';
import * as contactDb from '../../contact/contactDataAccess';
import {
  connectContactToCase,
  createContact,
  patchContact,
} from '../../contact/contactService';

import { omit } from 'lodash';
import { newOk, newOkFromData } from '@tech-matters/types';
import * as profilesDB from '../../profile/profileDataAccess';
import * as profilesService from '../../profile/profileService';
import { NewContactRecord } from '../../contact/sql/contactInsertSql';
import { ALWAYS_CAN } from '../mocks';
import '@tech-matters/testing/expectToParseAsDate';
import * as entityChangeNotify from '../../notifications/entityChangeNotify';

const flushPromises = async () => {
  await new Promise(process.nextTick);
  await new Promise(process.nextTick);
  await new Promise(process.nextTick);
  await new Promise(process.nextTick);
};

const publishContactChangeNotificationSpy = jest
  .spyOn(entityChangeNotify, 'publishContactChangeNotification')
  .mockImplementation(() => Promise.resolve('Ok') as any);

const accountSid = 'AC-accountSid';
const parameterAccountSid = 'AC-parameter account-sid';
const contactCreatorSid = 'WK-contact-creator';
const contactPatcherSid = 'WK-contact-patcher';
const baselineDate = new Date(2020, 1, 1);

jest.mock('../../contact/contactDataAccess');

const getIdentifierWithProfilesSpy = jest
  .spyOn(profilesDB, 'getIdentifierWithProfiles')
  .mockImplementation(() => async () => ({
    id: 1,
    identifier: 'identifier',
    accountSid: 'AC-accountSid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'WK-createdBy',
    profiles: [
      {
        id: 1,
        accountSid: 'AC-accountSid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'name',
        definitionVersion: 'as-v1',
        contactsCount: 0,
        casesCount: 0,
        createdBy: 'WK-createdBy',
      },
    ],
  }));

const mockContactRecord: contactDb.ContactRecord = {
  id: 1234,
  accountSid: 'AC-accountSid',
  csamReports: [],
  referrals: [],
  conversationMedia: [],
  rawJson: {} as any,
  createdAt: baselineDate.toISOString(),
  definitionVersion: 'as-v1',
};

const mockContact: contactDb.Contact = {
  ...mockContactRecord,
  id: '1234',
} as unknown as contactDb.Contact;

afterEach(() => {
  jest.clearAllMocks();
});

describe('createContact', () => {
  beforeEach(() => {
    const conn = mockConnection();
    mockTransaction(conn, undefined, parameterAccountSid);
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
    twilioWorkerId: 'WK-owning-worker-id',
    timeOfContact: new Date(2010, 5, 15).toISOString(),
    createdBy: 'WK-ignored-worker-id',
    helpline: 'a helpline',
    taskId: 'a task',
    channel: 'morse code',
    number: "that's numberwang",
    channelSid: 'a channel',
    serviceSid: 'a service',
    definitionVersion: 'as-v1',
  };

  const spyOnContact = ({
    mocks,
  }: {
    mocks?: {
      contactMockReturn: ReturnType<typeof contactDb.create>;
      getContactMock: contactDb.ContactRecord;
    };
  } = {}) => {
    const createContactMock = mocks
      ? jest.fn(mocks.contactMockReturn)
      : jest.fn(() =>
          Promise.resolve(
            newOkFromData({ contact: mockContactRecord, isNewRecord: true }),
          ),
        );
    const createSpy = jest
      .spyOn(contactDb, 'create')
      .mockReturnValueOnce(createContactMock);
    const getByIdSpy = mocks
      ? jest.spyOn(contactDb, 'getById').mockResolvedValueOnce(mocks.getContactMock)
      : jest.spyOn(contactDb, 'getById').mockResolvedValueOnce(mockContactRecord);

    return { createContactMock, createSpy, getByIdSpy };
  };

  test("Passes payload down to data layer with user workerSid used for 'createdBy'", async () => {
    const { createContactMock } = spyOnContact();
    const returnValue = await createContact(
      parameterAccountSid,
      'WK-contact-creator',
      sampleCreateContactPayload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith(parameterAccountSid, {
      ...sampleCreateContactPayload,
      createdBy: contactCreatorSid,
      profileId: 1,
      identifierId: 1,
    });

    await flushPromises();
    expect(publishContactChangeNotificationSpy).toHaveBeenCalled();
    expect(returnValue).toStrictEqual(mockContact);
  });

  test("If no identifier record exists for 'number', call createIdentifierAndProfile", async () => {
    const { createContactMock } = spyOnContact();

    getIdentifierWithProfilesSpy.mockImplementationOnce(() => async () => null);

    jest.spyOn(profilesService, 'createIdentifierAndProfile').mockImplementationOnce(
      () => async () =>
        newOk({
          data: { id: 2, profiles: [{ id: 2 }] },
        }) as any,
    );

    const returnValue = await createContact(
      parameterAccountSid,
      'WK-contact-creator',
      sampleCreateContactPayload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith(parameterAccountSid, {
      ...sampleCreateContactPayload,
      createdBy: contactCreatorSid,
      profileId: 2,
      identifierId: 2,
    });

    await flushPromises();
    expect(publishContactChangeNotificationSpy).toHaveBeenCalled();
    expect(returnValue).toStrictEqual(mockContact);
  });

  test('Missing values are converted to empty strings for several fields', async () => {
    const { createContactMock } = spyOnContact();

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
      parameterAccountSid,
      contactCreatorSid,
      minimalPayload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith(parameterAccountSid, {
      ...minimalPayload,
      createdBy: contactCreatorSid,
      helpline: '',
      number: '',
      channel: '',
      channelSid: '',
      serviceSid: '',
      twilioWorkerId: undefined,
      profileId: undefined,
      identifierId: undefined,
    });

    await flushPromises();
    expect(publishContactChangeNotificationSpy).toHaveBeenCalled();
    expect(returnValue).toStrictEqual(mockContact);
  });

  test('Missing timeOfContact value is substituted with current date', async () => {
    const { createContactMock } = spyOnContact();

    const payload = omit(sampleCreateContactPayload, 'timeOfContact');
    const returnValue = await createContact(
      parameterAccountSid,
      contactCreatorSid,
      payload,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith(parameterAccountSid, {
      ...payload,
      timeOfContact: expect.toParseAsDate(),
      createdBy: contactCreatorSid,
      profileId: 1,
      identifierId: 1,
    });

    await flushPromises();
    expect(publishContactChangeNotificationSpy).toHaveBeenCalled();
    expect(returnValue).toStrictEqual(mockContact);
  });

  test('queue will be empty if not present', async () => {
    const { createContactMock } = spyOnContact();

    const payload = omit(sampleCreateContactPayload, 'queueName');
    const legacyPayload = omit(sampleCreateContactPayload, 'queueName');
    const returnValue = await createContact(
      parameterAccountSid,
      contactCreatorSid,
      legacyPayload as any,
      ALWAYS_CAN,
    );
    expect(createContactMock).toHaveBeenCalledWith(parameterAccountSid, {
      ...payload,
      queueName: '',
      createdBy: contactCreatorSid,
      profileId: 1,
      identifierId: 1,
    });

    await flushPromises();
    expect(publishContactChangeNotificationSpy).toHaveBeenCalled();
    expect(returnValue).toStrictEqual(mockContact);
  });
});

describe('connectContactToCase', () => {
  test('Returns contact produced by data access layer', async () => {
    const connectSpy = jest.fn();
    jest.spyOn(contactDb, 'getById').mockResolvedValueOnce(mockContactRecord);
    connectSpy.mockResolvedValue(mockContactRecord);
    jest.spyOn(contactDb, 'connectToCase').mockImplementation(() => connectSpy);
    const result = await connectContactToCase(accountSid, '1234', '4321', ALWAYS_CAN);
    expect(connectSpy).toHaveBeenCalledWith(
      accountSid,
      '1234',
      '4321',
      ALWAYS_CAN.user.workerSid,
    );

    await flushPromises();
    expect(publishContactChangeNotificationSpy).toHaveBeenCalled();
    expect(result).toStrictEqual(mockContact);
  });

  test('Throws if data access layer returns undefined', () => {
    jest
      .spyOn(contactDb, 'connectToCase')
      .mockImplementation(() => () => Promise.resolve(undefined));
    expect(
      connectContactToCase(accountSid, '1234', '4321', ALWAYS_CAN),
    ).rejects.toThrow();
    expect(publishContactChangeNotificationSpy).not.toHaveBeenCalled();
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
  beforeEach(() => {
    const conn = mockConnection();
    mockTransaction(conn, undefined, accountSid);
  });
  test('Passes callerInformation, childInformation, caseInformation & categories to data layer as separate properties', async () => {
    const patchSpy = jest.fn();
    jest.spyOn(contactDb, 'patch').mockReturnValue(patchSpy);
    jest.spyOn(contactDb, 'getById').mockResolvedValue(mockContactRecord);
    patchSpy.mockResolvedValue(mockContactRecord);
    const result = await patchContact(
      accountSid,
      contactPatcherSid,
      true,
      '1234',
      samplePatch,
      ALWAYS_CAN,
    );

    await flushPromises();
    expect(publishContactChangeNotificationSpy).toHaveBeenCalled();
    expect(result).toStrictEqual(mockContact);
    expect(patchSpy).toHaveBeenCalledWith(accountSid, '1234', true, {
      updatedBy: contactPatcherSid,
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

    expect(publishContactChangeNotificationSpy).not.toHaveBeenCalled();
    expect(
      patchContact(accountSid, contactPatcherSid, true, '1234', samplePatch, ALWAYS_CAN),
    ).rejects.toThrow();
  });
});
