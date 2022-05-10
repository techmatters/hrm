const createError = require('http-errors');
const Sequelize = require('sequelize');
const { formatNumber } = require('./helpers');
const models = require('../models');

const { CSAMReport } = models;
const CSAMReportController = require('./csam-report-controller')(CSAMReport);

const { Op } = Sequelize;

function redact(form) {
  if (!form) {
    return form;
  }

  return {
    ...form,
    number: formatNumber(form.number),
  };
}

const ContactController = Contact => {
  const getContacts = async (query, accountSid) => {
    const { queueName } = query;
    const queryObject = {
      include: { association: 'csamReports' },
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
      csamReports: e.csamReports,
    }));
  };

  const getContactsById = async (contactIds, accountSid) => {
    const queryObject = {
      include: { association: 'csamReports' },
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

  const getContact = async (id, accountSid) => {
    const options = {
      include: { association: 'csamReports' },
      where: { [Op.and]: [{ id }, { accountSid }] },
    };
    const contact = await Contact.findOne(options);

    if (!contact) {
      const errorMessage = `Contact with id ${id} not found`;
      throw createError(404, errorMessage);
    }

    return contact;
  };

  /**
   *
   * @param {} body
   * @param {string} accountSid
   * @param {string} workerSid
   */
  const createContact = async (body, accountSid, workerSid) => {
    // if a contact has been already created with this taskId, just return it (idempotence on taskId). Should we use a different HTTP code status for this case?
    if (body.taskId) {
      const contact = await Contact.findOne({
        include: { association: 'csamReports' },
        where: { taskId: body.taskId },
      });
      if (contact) return contact;
    }

    const contactRecord = {
      rawJson: body.form,
      twilioWorkerId: body.twilioWorkerId || '',
      createdBy: workerSid,
      updatedBy: null,
      helpline: body.helpline || '',
      queueName: body.queueName || body.form.queueName,
      number: body.number || '',
      channel: body.channel || '',
      conversationDuration: body.conversationDuration,
      accountSid: accountSid || '',
      timeOfContact: body.timeOfContact || Date.now(),
      taskId: body.taskId || '',
      channelSid: body.channelSid || '',
      serviceSid: body.serviceSid || '',
    };

    const contact = await Contact.create(contactRecord);

    // Link all of the csam reports related to this contact (if any) and return the record with associations
    if (body.csamReports && body.csamReports.length) {
      const reportIds = body.csamReports.map(e => e.id).filter(Boolean);
      await CSAMReportController.connectContactToReports(contact.id, reportIds, accountSid);
      return getContact(contact.id, accountSid);
    }

    return contact;
  };

  return {
    getContacts,
    getContactsById,
    getContact,
    createContact,
  };
};

module.exports = ContactController;
