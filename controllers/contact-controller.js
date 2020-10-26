const createError = require('http-errors');
const Sequelize = require('sequelize');
const parseISO = require('date-fns/parseISO');
const startOfDay = require('date-fns/startOfDay');
const endOfDay = require('date-fns/endOfDay');
const { retrieveCategories, getPaginationElements } = require('./helpers');

const { Op } = Sequelize;

// Intentionally adding only the types of interest here
const callTypes = {
  child: 'Child calling about self',
  caller: 'Someone calling about a child',
};

function formatNumber(number) {
  if (number == null || number === 'Anonymous' || number === 'Customer') {
    return number;
  }

  const len = number.length;
  return number.slice(0, 4) + 'X'.repeat(len - 7) + number.slice(len - 3);
}

function redact(form) {
  if (!form) {
    return form;
  }

  return {
    ...form,
    number: formatNumber(form.number),
  };
}

function isEmptySearchParams(body) {
  const { helpline, firstName, lastName, counselor, phoneNumber, dateFrom, dateTo } = body;

  const anyValue =
    helpline || firstName || lastName || counselor || phoneNumber || dateFrom || dateTo;

  return !anyValue;
}

const orUndefined = value => value || undefined;

const queryOnName = (firstName, lastName) =>
  (firstName || lastName) && {
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
              firstName && {
                'rawJson.childInformation.name.firstName': {
                  [Op.iLike]: `%${firstName}%`,
                },
              },
              lastName && {
                'rawJson.childInformation.name.lastName': {
                  [Op.iLike]: `%${lastName}%`,
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
              firstName && {
                'rawJson.callerInformation.name.firstName': {
                  [Op.iLike]: `%${firstName}%`,
                },
              },
              lastName && {
                'rawJson.callerInformation.name.lastName': {
                  [Op.iLike]: `%${lastName}%`,
                },
              },
            ],
          },
        ],
      },
    ],
  };

const queryOnPhone = phoneNumber => {
  const re = /[\D]/gi;
  const phoneDigitsOnly = phoneNumber ? phoneNumber.replace(re, '') : undefined;

  // column should be passed via Sequelize.col or Sequelize.literal
  const phoneRegExp = column =>
    Sequelize.where(Sequelize.fn('REGEXP_REPLACE', column, '[^[:digit:]]', '', 'g'), {
      [Op.iLike]: `%${phoneDigitsOnly}%`,
    });

  return (
    phoneDigitsOnly && {
      [Op.or]: [
        { number: { [Op.iLike]: `%${phoneDigitsOnly}%` } },
        phoneRegExp(Sequelize.literal(`"rawJson"#>>'{childInformation,location,phone1}'`)),
        phoneRegExp(Sequelize.literal(`"rawJson"#>>'{childInformation,location,phone2}'`)),
        phoneRegExp(Sequelize.literal(`"rawJson"#>>'{callerInformation,location,phone1}'`)),
        phoneRegExp(Sequelize.literal(`"rawJson"#>>'{callerInformation,location,phone2}'`)),
      ],
    }
  );
};

function buildSearchQueryObject(body, query) {
  const {
    helpline,
    firstName,
    lastName,
    counselor,
    phoneNumber,
    dateFrom,
    dateTo,
    onlyDataContacts,
  } = body;

  const { limit, offset } = getPaginationElements(query);

  const compareCounselor = orUndefined(counselor);
  const compareDateFrom = orUndefined(dateFrom);
  const compareDateTo = orUndefined(dateTo);

  return {
    where: {
      [Op.and]: [
        helpline && {
          [Op.or]: [{ helpline: '' }, { helpline: { [Op.is]: null } }, { helpline }],
        },
        {
          [Op.and]: [
            queryOnName(firstName, lastName),
            compareCounselor && {
              twilioWorkerId: counselor,
            },
            queryOnPhone(phoneNumber),
            compareDateFrom && {
              createdAt: {
                [Op.gte]: startOfDay(parseISO(dateFrom)),
              },
            },
            compareDateTo && {
              createdAt: {
                [Op.lte]: endOfDay(parseISO(dateTo)),
              },
            },
            onlyDataContacts && {
              'rawJson.callType': {
                [Op.in]: [callTypes.child, callTypes.caller],
              },
            },
          ],
        },
      ],
    },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  };
}

function isNullOrEmptyObject(obj) {
  return obj == null || Object.keys(obj).length === 0;
}

function isValidContact(contact) {
  return (
    contact &&
    contact.rawJson &&
    !isNullOrEmptyObject(contact.rawJson.callType) &&
    !isNullOrEmptyObject(contact.rawJson.childInformation) &&
    !isNullOrEmptyObject(contact.rawJson.callerInformation) &&
    !isNullOrEmptyObject(contact.rawJson.caseInformation)
  );
}

function convertContactsToSearchResults(contacts) {
  return contacts
    .map(contact => {
      if (!isValidContact(contact)) {
        const contactJson = JSON.stringify(contact);
        console.log(`Invalid Contact: ${contactJson}`);
        return null;
      }

      const contactId = contact.id;
      const dateTime = contact.createdAt;
      const name = `${contact.rawJson.childInformation.name.firstName} ${contact.rawJson.childInformation.name.lastName}`;
      const customerNumber = contact.number;
      const { callType, caseInformation } = contact.rawJson;
      const categories = retrieveCategories(caseInformation.categories);
      const counselor = contact.twilioWorkerId;
      const notes = contact.rawJson.caseInformation.callSummary;
      const { channel, conversationDuration } = contact;

      return {
        contactId,
        overview: {
          dateTime,
          name,
          customerNumber,
          callType,
          categories,
          counselor,
          notes,
          channel,
          conversationDuration,
        },
        details: contact.rawJson,
      };
    })
    .filter(contact => contact);
}

const ContactController = Contact => {
  const searchContacts = async (body, query = {}) => {
    if (isEmptySearchParams(body)) {
      return { count: 0, contacts: [] };
    }
    const queryObject = buildSearchQueryObject(body, query);
    const { count, rows } = await Contact.findAndCountAll(queryObject);
    const contacts = convertContactsToSearchResults(rows);
    return { count, contacts };
  };

  const getContacts = async query => {
    const queryObject = {
      order: [['createdAt', 'DESC']],
      limit: 10,
    };
    if (query.queueName) {
      queryObject.where = {
        queueName: {
          [Op.like]: `${query.queueName}%`,
        },
      };
    }
    const contacts = await Contact.findAll(queryObject);
    return contacts.map(e => ({
      id: e.id,
      Date: e.createdAt,
      FormData: redact(e.rawJson),
      twilioWorkerId: e.twilioWorkerId,
      helpline: e.helpline,
      queueName: e.queueName,
      number: formatNumber(e.number),
      channel: e.channel,
      conversationDuration: e.conversationDuration,
    }));
  };

  const getContactsById = async contactIds => {
    const queryObject = {
      where: {
        id: {
          [Op.in]: contactIds,
        },
      },
    };

    return Contact.findAll(queryObject);
  };

  const createContact = async body => {
    const contactRecord = {
      rawJson: body.form,
      twilioWorkerId: body.twilioWorkerId || '',
      helpline: body.helpline || '',
      queueName: body.queueName || body.form.queueName,
      number: body.number || '',
      channel: body.channel || '',
      conversationDuration: body.conversationDuration,
    };

    const contact = await Contact.create(contactRecord);
    return contact;
  };

  const getContact = async id => {
    const contact = await Contact.findByPk(id);

    if (!contact) {
      const errorMessage = `Contact with id ${id} not found`;
      throw createError(404, errorMessage);
    }

    return contact;
  };

  const connectToCase = async (contactId, caseId) => {
    const contact = await getContact(contactId);
    const updatedContact = await contact.update({ caseId });

    return updatedContact;
  };

  return {
    searchContacts,
    getContacts,
    getContactsById,
    createContact,
    connectToCase,
    queries: { queryOnName, queryOnPhone },
  };
};

module.exports = ContactController;
