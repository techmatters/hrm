const Sequelize = require('sequelize');
const SequelizeMock = require('sequelize-mock');
const createCSAMReportController = require('../../controllers/csam-report-controller');

const DBConnectionMock = new SequelizeMock();
const MockCSAMReport = DBConnectionMock.define('CSAMReports');

const CSAMReportController = createCSAMReportController(MockCSAMReport);

const { Op } = Sequelize;

const accountSid = 'account-sid';
const workerSid = 'worker-sid';

test('create CSAM report', async () => {
  const createSpy = jest.spyOn(MockCSAMReport, 'create');

  const csamReportToBeCreated = {
    twilioWorkerId: workerSid,
    csamReportId: '1',
    //  contactId: ,
  };

  const expected = {
    ...csamReportToBeCreated,
    accountSid,
    contactId: null,
  };
  await CSAMReportController.createCSAMReport(csamReportToBeCreated, accountSid);

  expect(createSpy).toHaveBeenCalledWith(expected);
});

describe('get all CSAM reports', () => {
  test('By account sid', async () => {
    const options = {
      where: { [Op.and]: [{ accountSid }, undefined] },
    };

    const findAllSpy = jest.spyOn(MockCSAMReport, 'findAll');

    await CSAMReportController.getCSAMReports(undefined, accountSid);

    expect(findAllSpy).toHaveBeenCalledWith(options);
  });

  test('By account sid & contact id', async () => {
    const contactId = 1;
    const options = {
      where: { [Op.and]: [{ accountSid }, { contactId }] },
    };

    const findAllSpy = jest.spyOn(MockCSAMReport, 'findAll');

    await CSAMReportController.getCSAMReports(contactId, accountSid);

    expect(findAllSpy).toHaveBeenCalledWith(options);
  });
});

test('get a single CSAM report by id', async () => {
  const reportId = 1;
  const options = {
    where: { [Op.and]: [{ id: reportId }, { accountSid }] },
  };

  const findOneSpy = jest.spyOn(MockCSAMReport, 'findOne');

  await CSAMReportController.getCSAMReport(reportId, accountSid);

  expect(findOneSpy).toHaveBeenCalledWith(options);
});

test('connect Contact to a list of CSAMReports', async () => {
  const contactId = 1;
  const reportId98 = 98;
  const reportId99 = 99;
  const reportIds = [reportId98, reportId99];

  const expectedQueryObject = {
    where: {
      [Op.and]: [accountSid && { accountSid }, { id: reportIds }],
    },
  };

  const updateSpy = jest.spyOn(MockCSAMReport, 'update').mockImplementation(() => {});

  await CSAMReportController.connectToContacts(contactId, reportIds, accountSid);

  expect(updateSpy).toHaveBeenCalledWith({ contactId }, expectedQueryObject);
});
