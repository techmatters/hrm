const Sequelize = require('sequelize');
const SequelizeMock = require('sequelize-mock');
const parseISO = require('date-fns/parseISO');
const startOfDay = require('date-fns/startOfDay');
const endOfDay = require('date-fns/endOfDay');
const createContactController = require('../controllers/contact-controller');
const ContactBuilder = require('./contact-builder');

const { Op } = Sequelize;
const DBConnectionMock = new SequelizeMock();
const MockContact = DBConnectionMock.define('Contacts');

jest.mock('../models/contact', () => () => MockContact);

afterEach(() => jest.clearAllMocks());

test('Return [] when no params are given', async () => {
  const ContactController = createContactController(DBConnectionMock);
  const result = await ContactController.searchContacts({});

  expect(result).toStrictEqual([]);
});

test('Return [] when only invalid params are given', async () => {
  const ContactController = createContactController(DBConnectionMock);
  const result = await ContactController.searchContacts({ invalid: 'invalid' });

  expect(result).toStrictEqual([]);
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
    .withCreatedAt('2020-03-10')
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
    .withCreatedAt('2020-03-15')
    .build();
  const expectedSearchResult = [
    {
      contactId: 'jill-id',
      overview: {
        dateTime: '2020-03-10T00:00:00.000Z',
        name: 'Jill Smith',
        customerNumber: '+120XXXXX142',
        callType: 'Child calling about self',
        categories: 'TBD',
        counselor: 'twilio-worker-id',
        notes: 'Lost young boy',
        channel: 'voice',
        conversationDuration: 10,
      },
      details: {
        ...jillSmith.rawJson,
        number: '+120XXXXX142',
      },
    },
    {
      contactId: 'sarah-id',
      overview: {
        dateTime: '2020-03-15T00:00:00.000Z',
        name: 'Sarah Park',
        customerNumber: 'Anonymous',
        callType: 'Child calling about self',
        categories: 'TBD',
        counselor: 'twilio-worker-id',
        notes: 'Young pregnant woman',
        channel: '',
        conversationDuration: null,
      },
      details: sarahPark.rawJson,
    },
  ];

  MockContact.$queueResult([MockContact.build(jillSmith), MockContact.build(sarahPark)]);
  const ContactController = createContactController(DBConnectionMock);
  const result = await ContactController.searchContacts({ helpline: 'helpline' });

  expect(result).toStrictEqual(expectedSearchResult);
});

test('Call findAll(queryObject) with given params', async () => {
  const body = {
    helpline: 'helpline',
    firstName: 'Jill',
    lastName: 'Smith',
    counselor: 'counselorId',
    phoneNumber: 'Anonymous',
    dateFrom: '2020-03-10',
    dateTo: '2020-03-15',
  };

  const expectedQueryObject = {
    where: {
      [Op.and]: [
        {
          helpline: body.helpline,
        },
        {
          [Op.and]: [
            {
              'rawJson.childInformation.name.firstName': {
                [Op.iLike]: body.firstName,
              },
            },
            {
              'rawJson.childInformation.name.lastName': {
                [Op.iLike]: body.lastName,
              },
            },
            {
              twilioWorkerId: body.counselor,
            },
            {
              number: {
                [Op.iLike]: `%${body.phoneNumber}%`,
              },
            },
            {
              createdAt: {
                [Op.gte]: startOfDay(parseISO(body.dateFrom)),
              },
            },
            {
              createdAt: {
                [Op.lte]: endOfDay(parseISO(body.dateTo)),
              },
            },
            undefined,
          ],
        },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 20,
  };

  const spy = jest.spyOn(MockContact, 'findAll');
  const ContactController = createContactController(DBConnectionMock);
  await ContactController.searchContacts(body);

  expect(spy).toHaveBeenCalledWith(expectedQueryObject);
});

test('Call findAll(queryObject) with singleInput param', async () => {
  const body = {
    helpline: 'helpline',
    singleInput: 'singleInput',
  };

  const expectedQueryObject = {
    where: {
      [Op.and]: [
        {
          helpline: body.helpline,
        },
        {
          [Op.or]: [
            {
              'rawJson.childInformation.name.firstName': {
                [Op.iLike]: body.singleInput,
              },
            },
            {
              'rawJson.childInformation.name.lastName': {
                [Op.iLike]: body.singleInput,
              },
            },
            undefined,
            {
              number: {
                [Op.iLike]: `%${body.singleInput}%`,
              },
            },
            undefined,
            undefined,
            undefined,
          ],
        },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 20,
  };

  const spy = jest.spyOn(MockContact, 'findAll');
  const ContactController = createContactController(DBConnectionMock);
  await ContactController.searchContacts(body);

  expect(spy).toHaveBeenCalledWith(expectedQueryObject);
});

test('Call findAll(queryObject) with singleInput param of type date', async () => {
  const body = {
    helpline: 'helpline',
    singleInput: '2020-03-10',
  };

  const expectedQueryObject = {
    where: {
      [Op.and]: [
        {
          helpline: body.helpline,
        },
        {
          [Op.or]: [
            {
              'rawJson.childInformation.name.firstName': {
                [Op.iLike]: body.singleInput,
              },
            },
            {
              'rawJson.childInformation.name.lastName': {
                [Op.iLike]: body.singleInput,
              },
            },
            undefined,
            {
              number: {
                [Op.iLike]: `%${body.singleInput}%`,
              },
            },
            undefined,
            undefined,
            {
              [Op.and]: [
                {
                  createdAt: {
                    [Op.gte]: startOfDay(parseISO(body.singleInput)),
                  },
                },
                {
                  createdAt: {
                    [Op.lte]: endOfDay(parseISO(body.singleInput)),
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 20,
  };

  const spy = jest.spyOn(MockContact, 'findAll');
  const ContactController = createContactController(DBConnectionMock);
  await ContactController.searchContacts(body);

  expect(spy).toHaveBeenCalledWith(expectedQueryObject);
});

test('Call findAll(queryObject) with singleInput and ignore other params', async () => {
  const body = {
    helpline: 'helpline',
    singleInput: 'singleInput',
    firstName: 'Jill',
    lastName: 'Smith',
    counselor: 'counselorId',
    phoneNumber: 'Anonymous',
    dateFrom: '2020-03-10',
    dateTo: '2020-03-15',
  };

  const expectedQueryObject = {
    where: {
      [Op.and]: [
        {
          helpline: body.helpline,
        },
        {
          [Op.or]: [
            {
              'rawJson.childInformation.name.firstName': {
                [Op.iLike]: body.singleInput,
              },
            },
            {
              'rawJson.childInformation.name.lastName': {
                [Op.iLike]: body.singleInput,
              },
            },
            undefined,
            {
              number: {
                [Op.iLike]: `%${body.singleInput}%`,
              },
            },
            undefined,
            undefined,
            undefined,
          ],
        },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 20,
  };

  const spy = jest.spyOn(MockContact, 'findAll');
  const ContactController = createContactController(DBConnectionMock);
  await ContactController.searchContacts(body);

  expect(spy).toHaveBeenCalledWith(expectedQueryObject);
});
