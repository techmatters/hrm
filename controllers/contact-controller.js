const createError = require('http-errors');
const Sequelize = require('sequelize');
const parseISO = require('date-fns/parseISO');
const startOfDay = require('date-fns/startOfDay');
const endOfDay = require('date-fns/endOfDay');
const {
  retrieveCategories,
  getPaginationElements,
  isEmptySearchParams,
  orUndefined,
} = require('./helpers');

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

function buildSearchQueryObject(body, query, accountSid) {
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
        helpline && { helpline },
        {
          [Op.and]: [
            accountSid && { accountSid },
            queryOnName(firstName, lastName),
            compareCounselor && {
              twilioWorkerId: counselor,
            },
            queryOnPhone(phoneNumber),
            compareDateFrom && {
              timeOfContact: {
                [Op.gte]: startOfDay(parseISO(dateFrom)),
              },
            },
            compareDateTo && {
              timeOfContact: {
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
    order: [['timeOfContact', 'DESC']],
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
      const dateTime = contact.timeOfContact;
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
  const searchContacts = async (body, query = {}, accountSid) => {
    if (isEmptySearchParams(body)) {
      return { count: 0, contacts: [] };
    }
    const queryObject = buildSearchQueryObject(body, query, accountSid);
    const { count, rows } = await Contact.findAndCountAll(queryObject);
    const contacts = convertContactsToSearchResults(rows);
    return { count, contacts };
  };

  const getContacts = async (query, accountSid) => {
    const { queueName } = query;
    const queryObject = {
      order: [['timeOfContact', 'DESC']],
      limit: 10,
    };

    queryObject.where = {
      [Op.and]: [
        accountSid && { accountSid },
        queueName && {
          queueName: {
            [Op.like]: `${queueName}%`,
          },
        },
      ],
    };

    const contacts = await Contact.findAll(queryObject);
    return contacts.map(e => ({
      id: e.id,
      Date: e.timeOfContact,
      FormData: redact(e.rawJson),
      twilioWorkerId: e.twilioWorkerId,
      helpline: e.helpline,
      queueName: e.queueName,
      number: formatNumber(e.number),
      channel: e.channel,
      conversationDuration: e.conversationDuration,
    }));
  };

  const getContactsById = async (contactIds, accountSid) => {
    const queryObject = {
      where: {
        [Op.and]: [
          accountSid && { accountSid },
          {
            id: {
              [Op.in]: contactIds,
            },
          },
        ],
      },
    };

    return Contact.findAll(queryObject);
  };

  const createContact = async (body, accountSid, workerSid) => {
    // if a contact has been already created with this taskId, just return it (idempotence on taskId). Should we use a different HTTP code status for this case?
    if (body.taskId) {
      const contact = await Contact.findOne({ where: { taskId: body.taskId } });
      if (contact) return contact;
    }

    const contactRecord = {
      rawJson: body.form,
      twilioWorkerId: body.twilioWorkerId || '',
      createdBy: workerSid,
      helpline: body.helpline || '',
      queueName: body.queueName || body.form.queueName,
      number: body.number || '',
      channel: body.channel || '',
      conversationDuration: body.conversationDuration,
      accountSid: accountSid || '',
      timeOfContact: body.timeOfContact || Date.now(),
      taskId: body.taskId || '',
    };

    const contact = await Contact.create(contactRecord);
    return contact;
  };

  const getContact = async (id, accountSid) => {
    const options = { where: { [Op.and]: [{ id }, { accountSid }] } };
    const contact = await Contact.findOne(options);

    if (!contact) {
      const errorMessage = `Contact with id ${id} not found`;
      throw createError(404, errorMessage);
    }

    return contact;
  };

  const connectToCase = async (contactId, caseId, accountSid, workerSid) => {
    const contact = await getContact(contactId, accountSid);
    const options = { context: { workerSid } };
    const updatedContact = await contact.update({ caseId }, options);

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
