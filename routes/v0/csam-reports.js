const models = require('../../models');
const { SafeRouter, publicEndpoint } = require('../../permissions');

const { CSAMReport } = models;
const CSAMReportController = require('../../controllers/csam-report-controller')(CSAMReport);

const csamReportRouter = SafeRouter();

csamReportRouter.post('/', publicEndpoint, async (
  /** @type {import('express').Request} */ req,
  /** @type {import('express').Response} */ res,
) => {
  const { accountSid } = req;

  const createdCSAMReport = await CSAMReportController.createCSAMReport(req.body, accountSid);
  res.json(createdCSAMReport);
});

module.exports = csamReportRouter.expressRouter;
