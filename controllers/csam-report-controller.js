const createError = require('http-errors');
const Sequelize = require('sequelize');

const { Op } = Sequelize;

const CSAMReportController = CSAMReport => {
  /**
   * @param {number} contactId
   * @param {string} accountSid
   */
  const getCSAMReports = async (contactId, accountSid) => {
    const queryObject = {
      where: {
        [Op.and]: [accountSid && { accountSid }, contactId && { contactId }],
      },
    };

    return CSAMReport.findAll(queryObject);
  };

  /**
   * @param {number} id
   * @param {string} accountSid
   */
  const getCSAMReport = async (id, accountSid) => {
    const queryObject = { where: { [Op.and]: [{ id }, { accountSid }] } };
    const report = await CSAMReport.findOne(queryObject);

    if (!report) {
      const errorMessage = `CSAM Report with id ${id} not found`;
      throw createError(404, errorMessage);
    }

    return report;
  };

  /**
   * @param {{ twilioWorkerId: string, contactId: number, csamReportId: string }} body
   * @param {string} accountSid
   */
  const createCSAMReport = async (body, accountSid) => {
    const record = {
      accountSid: accountSid || '',
      twilioWorkerId: body.twilioWorkerId || '',
      csamReportId: body.csamReportId || '',
      contactId: body.contactId || null,
    };

    const csamReport = await CSAMReport.create(record);
    return csamReport;
  };

  /**
   * Updates all the reports with id "in reportIds", linking them with the contact of id contactId
   * @param {number} contactId
   * @param {number[]} reportIds
   * @param {string} accountSid
   */
  const connectToContacts = async (contactId, reportIds, accountSid) => {
    const queryObject = {
      where: {
        [Op.and]: [accountSid && { accountSid }, { id: reportIds }],
      },
    };

    const updatedReports = await CSAMReport.update({ contactId }, queryObject);

    return updatedReports;
  };

  return {
    getCSAMReports,
    getCSAMReport,
    createCSAMReport,
    connectToContacts,
  };
};

module.exports = CSAMReportController;
