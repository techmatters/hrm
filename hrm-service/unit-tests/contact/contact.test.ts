import * as contactDb from '../../src/contact/contact-data-access';
import {
  connectContactToCase,
  patchContact,
  SearchContact,
  searchContacts,
} from '../../src/contact/contact';
import { ContactBuilder } from './contact-builder';

jest.mock('../../src/contact/contact-data-access');

const mockContact: contactDb.Contact = {
  id: 1234,
  accountSid: 'accountSid',
  csamReports: [],
};

describe('connectContactToCase', () => {
  test('Returns contact produced by data access layer', async () => {
    const connectSpy = jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(mockContact);
    const result = await connectContactToCase('accountSid', 'case-connector', '1234', '4321');
    expect(connectSpy).toHaveBeenCalledWith('accountSid', '1234', '4321');
    expect(result).toStrictEqual(mockContact);
  });
  test('Throws if data access layer returns undefined', () => {
    jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(undefined);
    expect(connectContactToCase('accountSid', 'case-connector', '1234', '4321')).rejects.toThrow();
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
    const result = await patchContact('accountSid', 'contact-patcher', '1234', samplePatch);
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
    expect(patchContact('accountSid', 'contact-patcher', '1234', samplePatch)).rejects.toThrow();
  });
});

describe('searchContacts', () => {
  const accountSid = 'account-sid',
    workerSid = 'contact-searcher';
  test('Converts contacts returned by data layer to search results', async () => {
    const jillSmith = new ContactBuilder()
      .withId(4321)
      .withHelpline('a helpline')
      .withChildFirstName('Jill')
      .withChildLastName('Smith')
      .withCallSummary('Lost young boy')
      .withNumber('+12025550142')
      .withCallType('Child calling about self')
      .withTwilioWorkerId('twilio-worker-id')
      .withCreatedBy(workerSid)
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
      .withCreatedBy(workerSid)
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
          },
          details: jillSmith.rawJson,
          csamReports: [],
        },
        {
          contactId: '1234',
          overview: {
            helpline: undefined,
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

    const result = await searchContacts(accountSid, parameters, {});

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
    await searchContacts(accountSid, body, {});

    expect(searchSpy).toHaveBeenCalledWith(accountSid, body, expect.any(Number), 0);
  });

  test('Call search without limit / offset, a default limit and offset 0', async () => {
    const body = {
      helpline: 'helpline',
      onlyDataContacts: true,
    };
    const searchSpy = jest.spyOn(contactDb, 'search').mockResolvedValue({ count: 0, rows: [] });
    await searchContacts(accountSid, body, { limit: 10, offset: 1000 });

    expect(searchSpy).toHaveBeenCalledWith(accountSid, body, 10, 1000);
  });
});
