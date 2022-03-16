const Sequelize = require('sequelize');
const SequelizeMock = require('sequelize-mock');
const parseISO = require('date-fns/parseISO');
const startOfDay = require('date-fns/startOfDay');
const endOfDay = require('date-fns/endOfDay');
const createContactController = require('../../src/controllers/contact-controller');
const ContactBuilder = require('./contact-builder');

const callTypes = {
  child: 'Child calling about self',
  caller: 'Someone calling about a child',
};

const { Op } = Sequelize;
const DBConnectionMock = new SequelizeMock();
const MockContact = DBConnectionMock.define('Contacts');

const ContactController = createContactController(MockContact);
const { queryOnName, queryOnPhone } = ContactController.queries;

const accountSid = 'account-sid';
const workerSid = 'worker-sid';

afterEach(() => jest.clearAllMocks());

const emptyResult = { count: 0, contacts: [] };

test('Return [] when no params are given', async () => {
  const result = await ContactController.searchContacts({}, undefined, accountSid);

  expect(result).toStrictEqual(emptyResult);
});

test('Return [] when only invalid params are given', async () => {
  const result = await ContactController.searchContacts(
    { invalid: 'invalid' },
    undefined,
    accountSid,
  );

  expect(result).toStrictEqual(emptyResult);
});

test('Convert contacts to searchResults', async () => {
  const jillSmith = new ContactBuilder()
    .withId('jill-id')
    .withChildFirstName('Jill')
    .withChildLastName('Smith')
    .withCallSummary('Lost young boy')
    .withNumber('+12025550142')
    .withCallType('Child calling about self')
    .withTwilioWorkerId('twilio-worker-id')
    .withCreatedBy(workerSid)
    .withCreatedAt('2020-03-10')
    .withTimeOfContact('2020-03-10')
    .withChannel('voice')
    .withConversationDuration(10)
    .build();
  const sarahPark = new ContactBuilder()
    .withId('sarah-id')
    .withChildFirstName('Sarah')
    .withChildLastName('Park')
    .withCallSummary('Young pregnant woman')
    .withNumber('Anonymous')
    .withCallType('Child calling about self')
    .withTwilioWorkerId('twilio-worker-id')
    .withCreatedBy(workerSid)
    .withCreatedAt('2020-03-15')
    .withTimeOfContact('2020-03-15')
    .build();
  const expectedSearchResult = {
    count: 2,
    contacts: [
      {
        contactId: 'jill-id',
        overview: {
          dateTime: '2020-03-10T00:00:00.000Z',
          name: 'Jill Smith',
          customerNumber: '+12025550142',
          createdBy: 'worker-sid',
          callType: 'Child calling about self',
          categories: {},
          counselor: 'twilio-worker-id',
          notes: 'Lost young boy',
          channel: 'voice',
          conversationDuration: 10,
        },
        details: {
          ...jillSmith.rawJson,
          number: '+12025550142',
        },
        csamReports: [],
      },
      {
        contactId: 'sarah-id',
        overview: {
          dateTime: '2020-03-15T00:00:00.000Z',
          name: 'Sarah Park',
          customerNumber: 'Anonymous',
          createdBy: 'worker-sid',
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
    rows: [MockContact.build(jillSmith), MockContact.build(sarahPark)],
  };

  MockContact.$queueResult(mockedResult);
  const result = await ContactController.searchContacts(
    { helpline: 'helpline' },
    undefined,
    accountSid,
  );

  expect(result).toStrictEqual(expectedSearchResult);
});

describe('Test queryOnName', () => {
  test('with firstName and lastName', async () => {
    const expected = {
      [Op.or]: [
        {
          [Op.and]: [
            {
              'rawJson.callType': {
                [Op.in]: [callTypes.child, callTypes.caller],
              },
            },
            {
              [Op.and]: [
                {
                  'rawJson.childInformation.name.firstName': {
                    [Op.iLike]: `%FirstName%`,
                  },
                },
                {
                  'rawJson.childInformation.name.lastName': {
                    [Op.iLike]: `%LastName%`,
                  },
                },
              ],
            },
          ],
        },
        {
          [Op.and]: [
            {
              'rawJson.callType': callTypes.caller,
            },
            {
              [Op.and]: [
                {
                  'rawJson.callerInformation.name.firstName': {
                    [Op.iLike]: `%FirstName%`,
                  },
                },
                {
                  'rawJson.callerInformation.name.lastName': {
                    [Op.iLike]: `%LastName%`,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = queryOnName('FirstName', 'LastName');

    expect(result).toStrictEqual(expected);
  });

  test('with firstName', async () => {
    const expected = {
      [Op.or]: [
        {
          [Op.and]: [
            {
              'rawJson.callType': {
                [Op.in]: [callTypes.child, callTypes.caller],
              },
            },
            {
              [Op.and]: [
                {
                  'rawJson.childInformation.name.firstName': {
                    [Op.iLike]: `%FirstName%`,
                  },
                },
                undefined,
              ],
            },
          ],
        },
        {
          [Op.and]: [
            {
              'rawJson.callType': callTypes.caller,
            },
            {
              [Op.and]: [
                {
                  'rawJson.callerInformation.name.firstName': {
                    [Op.iLike]: `%FirstName%`,
                  },
                },
                undefined,
              ],
            },
          ],
        },
      ],
    };

    const result = queryOnName('FirstName', undefined);

    expect(result).toStrictEqual(expected);
  });

  test('with lastName', async () => {
    const expected = {
      [Op.or]: [
        {
          [Op.and]: [
            {
              'rawJson.callType': {
                [Op.in]: [callTypes.child, callTypes.caller],
              },
            },
            {
              [Op.and]: [
                undefined,
                {
                  'rawJson.childInformation.name.lastName': {
                    [Op.iLike]: `%LastName%`,
                  },
                },
              ],
            },
          ],
        },
        {
          [Op.and]: [
            {
              'rawJson.callType': callTypes.caller,
            },
            {
              [Op.and]: [
                undefined,
                {
                  'rawJson.callerInformation.name.lastName': {
                    [Op.iLike]: `%LastName%`,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = queryOnName(undefined, 'LastName');

    expect(result).toStrictEqual(expected);
  });
});

describe('Test queryOnPhone', () => {
  test('with phoneNumber', async () => {
    const expected = {
      [Op.or]: [
        { number: { [Op.iLike]: `%${12125551212}%` } },
        Sequelize.where(
          Sequelize.fn(
            'REGEXP_REPLACE',
            Sequelize.literal(`"rawJson"#>>'{childInformation,location,phone1}'`),
            '[^[:digit:]]',
            '',
            'g',
          ),
          {
            [Op.iLike]: `%${12125551212}%`,
          },
        ),
        Sequelize.where(
          Sequelize.fn(
            'REGEXP_REPLACE',
            Sequelize.literal(`"rawJson"#>>'{childInformation,location,phone2}'`),
            '[^[:digit:]]',
            '',
            'g',
          ),
          {
            [Op.iLike]: `%${12125551212}%`,
          },
        ),
        Sequelize.where(
          Sequelize.fn(
            'REGEXP_REPLACE',
            Sequelize.literal(`"rawJson"#>>'{callerInformation,location,phone1}'`),
            '[^[:digit:]]',
            '',
            'g',
          ),
          {
            [Op.iLike]: `%${12125551212}%`,
          },
        ),
        Sequelize.where(
          Sequelize.fn(
            'REGEXP_REPLACE',
            Sequelize.literal(`"rawJson"#>>'{callerInformation,location,phone2}'`),
            '[^[:digit:]]',
            '',
            'g',
          ),
          {
            [Op.iLike]: `%${12125551212}%`,
          },
        ),
      ],
    };

    const result1 = queryOnPhone('+1 (212) 555-1212');

    expect(result1).toStrictEqual(expected);
  });
});

test('Call findAndCountAll(queryObject) with given params', async () => {
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

  const spy = jest.spyOn(MockContact, 'findAndCountAll');
  await ContactController.searchContacts(body, undefined, accountSid);

  const expectedQueryObject = {
    include: { association: 'csamReports' },
    where: {
      [Op.and]: [
        {
          helpline: body.helpline,
        },
        {
          [Op.and]: [
            { accountSid },
            queryOnName(body.firstName, body.lastName),
            {
              twilioWorkerId: body.counselor,
            },
            queryOnPhone(body.phoneNumber),
            {
              timeOfContact: {
                [Op.gte]: startOfDay(parseISO(body.dateFrom)),
              },
            },
            {
              timeOfContact: {
                [Op.lte]: endOfDay(parseISO(body.dateTo)),
              },
            },
            {
              number: body.contactNumber,
            },
            {
              'rawJson.callType': {
                [Op.in]: [callTypes.child, callTypes.caller],
              },
            },
          ],
        },
      ],
    },
    order: [['timeOfContact', 'DESC']],
    limit: 1000,
    offset: 0,
  };

  expect(spy).toHaveBeenCalledWith(expectedQueryObject);
});

test('Call findAndCountAll(queryObject) without name search', async () => {
  const body = {
    helpline: 'helpline',
    counselor: 'counselorId',
    phoneNumber: '123',
    dateFrom: '2020-03-10',
    dateTo: '2020-03-15',
    contactNumber: '+123456',
    onlyDataContacts: true,
  };

  const spy = jest.spyOn(MockContact, 'findAndCountAll');
  await ContactController.searchContacts(body, undefined, accountSid);

  const expectedQueryObject = {
    include: { association: 'csamReports' },
    where: {
      [Op.and]: [
        {
          helpline: body.helpline,
        },
        {
          [Op.and]: [
            { accountSid },
            undefined,
            {
              twilioWorkerId: body.counselor,
            },
            queryOnPhone(body.phoneNumber),
            {
              timeOfContact: {
                [Op.gte]: startOfDay(parseISO(body.dateFrom)),
              },
            },
            {
              timeOfContact: {
                [Op.lte]: endOfDay(parseISO(body.dateTo)),
              },
            },
            {
              number: body.contactNumber,
            },
            {
              'rawJson.callType': {
                [Op.in]: [callTypes.child, callTypes.caller],
              },
            },
          ],
        },
      ],
    },
    order: [['timeOfContact', 'DESC']],
    limit: 1000,
    offset: 0,
  };

  expect(spy).toHaveBeenCalledWith(expectedQueryObject);
});

test('connect contact to case', async () => {
  const contactId = 1;
  const caseId = 2;
  const contactFromDB = {
    id: contactId,
    update: jest.fn(),
  };
  jest.spyOn(MockContact, 'findOne').mockImplementation(() => contactFromDB);
  const updateSpy = jest.spyOn(contactFromDB, 'update');

  const updateCaseObject = { caseId };
  const contextObject = { context: { workerSid } };

  await ContactController.connectToCase(contactId, caseId, accountSid, workerSid);

  expect(updateSpy).toHaveBeenCalledWith(updateCaseObject, contextObject);
});

test('connect non existing contact to case', async () => {
  const nonExistingContactId = 1;
  const caseId = 2;
  jest.spyOn(MockContact, 'findOne').mockImplementation(() => null);

  await expect(
    ContactController.connectToCase(nonExistingContactId, caseId, accountSid, workerSid),
  ).rejects.toThrow();
});
