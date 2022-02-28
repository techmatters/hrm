const models = require('../../models');
const { SafeRouter, publicEndpoint, canEditCase } = require('../../permissions');
const { getCaseActivities } = require('../../controllers/activities');

const { Case, sequelize } = models;
const CaseController = require('../../controllers/case-controller')(Case, sequelize);

const casesRouter = SafeRouter();

casesRouter.get('/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const cases = await CaseController.listCases(req.query, accountSid);
  res.json(cases);
});

casesRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;

  const createdCase = await CaseController.createCase(req.body, accountSid, user.workerSid);
  res.json(createdCase);
});

casesRouter.put('/:id', canEditCase, async (req, res) => {
  const { accountSid, user } = req;
  const { id } = req.params;
  const updatedCase = await CaseController.updateCase(id, req.body, accountSid, user.workerSid);
  res.json(updatedCase);
});

casesRouter.delete('/:id', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  await CaseController.deleteCase(id, accountSid);
  res.sendStatus(200);
});

casesRouter.get('/:caseId/activities/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { caseId } = req.params;
  const activities = await getCaseActivities(caseId, accountSid);

  res.json(activities);
});

casesRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await CaseController.searchCases(req.body, req.query, accountSid);
  res.json(searchResults);
});

module.exports = casesRouter.expressRouter;
