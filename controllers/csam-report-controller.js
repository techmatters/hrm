const createError = require('http-errors');
const Sequelize = require('sequelize');

const { Op } = Sequelize;

const CSAMReportController = CSAMReport => {
  /**
   * @param {string} contactId
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
   * @param {string} id
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
   * @param {{ twilioWorkerId: string, contactId: string, csamReportId: string }} body
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
   *
   * @param {number} contactId
   * @param {number} reportId
   * @param {string} accountSid
   */
  const connectToContact = async (contactId, reportId, accountSid) => {
    const report = await getCSAMReport(reportId, accountSid);

    const updatedReport = await report.update({ contactId });

    return updatedReport;
  };

  return {
    getCSAMReports,
    getCSAMReport,
    createCSAMReport,
    connectToContact,
  };
};

module.exports = CSAMReportController;
