import * as casesDb from '../../db/case';
const models = require('../../models');
const { SafeRouter, publicEndpoint, canEditCase } = require('../../permissions');

const { Contact, Case, CaseAudit, sequelize } = models;
const ContactController = require('../../controllers/contact-controller')(Contact);
const CaseController = require('../../controllers/case-controller')(Case, sequelize);
const CaseAuditController = require('../../controllers/case-audit-controller')(CaseAudit);


const casesRouter = SafeRouter();

casesRouter.get('/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const cases = await casesDb.list(req.query, accountSid);
  res.json(cases);
});

casesRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;

  //const createdCase = await CaseController.createCase(req.body, accountSid, user.workerSid);
  const createdCase = await casesDb.create(req.body, accountSid, user.workerSid);

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
  await CaseController.getCase(caseId, accountSid);
  const caseAudits = await CaseAuditController.getAuditsForCase(caseId, accountSid);
  const contactIds = CaseAuditController.getContactIdsFromCaseAudits(caseAudits);
  const relatedContacts = await ContactController.getContactsById(contactIds, accountSid);
  const activities = await CaseAuditController.getActivities(caseAudits, relatedContacts);

  res.json(activities);
});

casesRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await CaseController.searchCases(req.body, req.query, accountSid);
  res.json(searchResults);
});

module.exports = casesRouter.expressRouter;
