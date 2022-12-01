import * as contactDb from '../../src/contact/contact-data-access';
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

jest.mock('../../src/contact/contact-data-access');

const workerSid = 'WORKER_SID';

const mockContact: contactDb.Contact = {
  id: 1234,
  accountSid: 'accountSid',
  csamReports: [],
};

describe('createContact', () => {
  const sampleCreateContactPayload = {
    rawJson: {
      childInformation: {
        name: {
          firstName: 'Lorna',
          lastName: 'Ballantyne',
        },
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
        user: { workerSid, roles: [] },
      },
    );
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...sampleCreateContactPayload, createdBy: 'contact-creator' },
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
        user: { workerSid, roles: [] },
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
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('Missing timeOfContact value is substituted with current date', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = omit(sampleCreateContactPayload, 'timeOfContact');
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: { workerSid, roles: [] },
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      {
        ...payload,
        timeOfContact: expect.any(Date),
        createdBy: 'contact-creator',
      },
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });

  test('rawJson will be read from form property if it is there and rawJson is not', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = omit(sampleCreateContactPayload, 'rawJson');
    payload.form = sampleCreateContactPayload.rawJson;
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: { workerSid, roles: [] },
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...sampleCreateContactPayload, createdBy: 'contact-creator' },
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('empty array will be passed for csamReportIds if csamReport property is missing', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = omit(sampleCreateContactPayload, 'csamReport');
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: { workerSid, roles: [] },
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, createdBy: 'contact-creator' },
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
      user: { workerSid, roles: [] },
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, createdBy: 'contact-creator' },
      expect.arrayContaining([2, 4, 6]),
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('queue will be looked for as a rawJson property if omitted from the top level', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = {
      ...omit(sampleCreateContactPayload, 'queueName'),
      rawJson: {
        ...sampleCreateContactPayload.rawJson,
        queueName: 'Q2',
      },
    };
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: { workerSid, roles: [] },
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, queueName: 'Q2', createdBy: 'contact-creator' },
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('queue will be looked for as a form property if omitted from the top level and rawJson', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = {
      ...omit(sampleCreateContactPayload, 'rawJson', 'queueName'),
      rawJson: {
        ...sampleCreateContactPayload.rawJson,
        queueName: 'Q2',
      },
    };
    payload.form = sampleCreateContactPayload.rawJson;
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: { workerSid, roles: [] },
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, queueName: 'Q2', createdBy: 'contact-creator' },
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
  test('queue will be undefined if not present on rawJson, form or top level', async () => {
    const createSpy = jest.spyOn(contactDb, 'create').mockResolvedValue(mockContact);
    const payload = omit(sampleCreateContactPayload, 'queueName');
    const returnValue = await createContact('parameter account-sid', 'contact-creator', payload, {
      can: () => true,
      user: { workerSid, roles: [] },
    });
    expect(createSpy).toHaveBeenCalledWith(
      'parameter account-sid',
      { ...payload, queueName: undefined, createdBy: 'contact-creator' },
      [],
    );
    expect(returnValue).toStrictEqual(mockContact);
  });
});

describe('connectContactToCase', () => {
  test('Returns contact produced by data access layer', async () => {
    const connectSpy = jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(mockContact);
    const result = await connectContactToCase('accountSid', 'case-connector', '1234', '4321', {
      can: () => true,
      user: { workerSid, roles: [] },
    });
    expect(connectSpy).toHaveBeenCalledWith('accountSid', '1234', '4321');
    expect(result).toStrictEqual(mockContact);
  });
  test('Throws if data access layer returns undefined', () => {
    jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(undefined);
    expect(
      connectContactToCase('accountSid', 'case-connector', '1234', '4321', {
        can: () => true,
        user: { workerSid, roles: [] },
      }),
    ).rejects.toThrow();
  });
});

describe('patchContact', () => {
  const samplePatch = {
    rawJson: {
      childInformation: {
        name: {
          firstName: 'Charlotte',
          lastName: 'Ballantyne',
        },
      },
      callerInformation: {
        name: {
          firstName: 'Lorna',
          lastName: 'Ballantyne',
        },
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
      user: { workerSid, roles: [] },
    });
    expect(result).toStrictEqual(mockContact);
    expect(patchSpy).toHaveBeenCalledWith('accountSid', '1234', {
      updatedBy: 'contact-patcher',
      childInformation: {
        name: {
          firstName: 'Charlotte',
          lastName: 'Ballantyne',
        },
      },
      callerInformation: {
        name: {
          firstName: 'Lorna',
          lastName: 'Ballantyne',
        },
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
        user: { workerSid, roles: [] },
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
            name: 'Jill Smith',
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
        },
        {
          contactId: '1234',
          overview: {
            helpline: undefined,
            taskId: undefined,
            dateTime: '2020-03-15T00:00:00.000Z',
            name: 'Sarah Park',
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
        user: { workerSid, roles: [] },
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
    const searchSpy = jest.spyOn(contactDb, 'search').mockResolvedValue({ count: 0, rows: [] });
    await searchContacts(
      accountSid,
      body,
      {},
      {
        can: () => true,
        user: { workerSid, roles: [] },
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
        user: { workerSid, roles: [] },
      },
    );

    expect(searchSpy).toHaveBeenCalledWith(accountSid, body, 10, 1000);
  });
});
