const Sequelize = require('sequelize');
const parseISO = require('date-fns/parseISO');
const startOfDay = require('date-fns/startOfDay');
const endOfDay = require('date-fns/endOfDay');
const isValid = require('date-fns/isValid');

const contactModel = require('../models/contact.js');

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
  const {
    helpline,
    firstName,
    lastName,
    counselor,
    phoneNumber,
    dateFrom,
    dateTo,
    singleInput,
  } = body;

  /**
   * Prettier currently enforces the operators (eg. ||) to the at the end of the line.
   * It's much more readable when it's placed at the beggining of the line. But that's
   * a current limitation of Prettier. There's a PR in place that will fix this in future
   * versions of Prettier: https://github.com/prettier/prettier/pull/7111.
   */
  const anyValue =
    helpline ||
    firstName ||
    lastName ||
    counselor ||
    phoneNumber ||
    dateFrom ||
    dateTo ||
    singleInput;

  return !anyValue;
}

const orUndefined = value => value || undefined;

function buildSearchQueryObject(body) {
  const {
    helpline,
    firstName,
    lastName,
    counselor,
    phoneNumber,
    dateFrom,
    dateTo,
    singleInput,
  } = body;

  const operator = singleInput ? Op.or : Op.and;
  const isSingleInputValidDate = orUndefined(singleInput && isValid(parseISO(singleInput)));
  const compareCounselor = orUndefined(counselor && !singleInput);
  const compareDateFrom = orUndefined(dateFrom && !singleInput);
  const compareDateTo = orUndefined(dateTo && !singleInput);

  return {
    where: {
      [Op.and]: [
        helpline && {
          helpline,
        },
        {
          [operator]: [
            (firstName || lastName || singleInput) && {
              [Op.or]: [
                {
                  [Op.and]: [
                    {
                      'rawJson.callType': {
                        [Op.in]: [callTypes.child, callTypes.caller],
                      },
                    },
                    {
                      [operator]: [
                        (firstName || singleInput) && {
                          'rawJson.childInformation.name.firstName': {
                            [Op.iLike]: `%${singleInput || firstName}%`,
                          },
                        },
                        (lastName || singleInput) && {
                          'rawJson.childInformation.name.lastName': {
                            [Op.iLike]: `%${singleInput || lastName}%`,
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  [Op.and]: [
                    {
                      'rawJson.callType': {
                        [Op.eq]: callTypes.caller,
                      },
                    },
                    {
                      [operator]: [
                        (firstName || singleInput) && {
                          'rawJson.callerInformation.name.firstName': {
                            [Op.iLike]: `%${singleInput || firstName}%`,
                          },
                        },
                        (lastName || singleInput) && {
                          'rawJson.callerInformation.name.lastName': {
                            [Op.iLike]: `%${singleInput || lastName}%`,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            compareCounselor && {
              twilioWorkerId: counselor,
            },
            (phoneNumber || singleInput) && {
              number: {
                [Op.iLike]: `%${singleInput || phoneNumber}%`,
              },
            },
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
            isSingleInputValidDate && {
              [Op.and]: [
                {
                  createdAt: {
                    [Op.gte]: startOfDay(parseISO(singleInput)),
                  },
                },
                {
                  createdAt: {
                    [Op.lte]: endOfDay(parseISO(singleInput)),
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
}

function isNonDataCallType(callType) {
  return callType !== callTypes.caller && callType !== callTypes.child;
}

const nonDataOrSummary = contact => {
  return (
    isNonDataCallType(contact.rawJson.callType) ||
    contact.rawJson.caseInformation.callSummary !== undefined
  );
};

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
    !isNullOrEmptyObject(contact.rawJson.caseInformation) &&
    nonDataOrSummary(contact)
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
      const { callType } = contact.rawJson;
      // TODO (Gian): retrieveTags must be done here instead than in flex plugin
      const categories = 'TBD';
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

const ContactController = sequelize => {
  const Contact = contactModel(sequelize, Sequelize);

  const searchContacts = async body => {
    if (isEmptySearchParams(body)) {
      return [];
    }
    const queryObject = buildSearchQueryObject(body);
    const contacts = await Contact.findAll(queryObject);
    return convertContactsToSearchResults(contacts);
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

  return { searchContacts, getContacts, createContact };
};

module.exports = ContactController;
