const { Router } = require('express');
const models = require('../../models');

const { Contact, Case, CaseAudit, sequelize } = models;
const ContactController = require('../../controllers/contact-controller')(Contact);
const CaseController = require('../../controllers/case-controller')(Case, sequelize);
const CaseAuditController = require('../../controllers/case-audit-controller')(CaseAudit);

const casesRouter = Router();

casesRouter.get('/', async (req, res) => {
  const { accountSid } = req;
  const cases = await CaseController.listCases(req.query, accountSid);
  res.json(cases);
});

casesRouter.post('/', async (req, res) => {
  const { accountSid } = req;

  const createdCase = await CaseController.createCase(req.body, accountSid);
  res.json(createdCase);
});

casesRouter.put('/:id', async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  const updatedCase = await CaseController.updateCase(id, req.body, accountSid);
  res.json(updatedCase);
});

casesRouter.delete('/:id', async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  await CaseController.deleteCase(id, accountSid);
  res.sendStatus(200);
});

casesRouter.get('/:caseId/activities/', async (req, res) => {
  const { accountSid } = req;
  const { caseId } = req.params;
  await CaseController.getCase(caseId, accountSid);
  const caseAudits = await CaseAuditController.getAuditsForCase(caseId, accountSid);
  const contactIds = CaseAuditController.getContactIdsFromCaseAudits(caseAudits);
  const relatedContacts = await ContactController.getContactsById(contactIds, accountSid);
  const activities = await CaseAuditController.getActivities(caseAudits, relatedContacts);

  res.json(activities);
});

casesRouter.post('/search', async (req, res) => {
  const { accountSid } = req;
  const searchResults = await CaseController.searchCases(req.body, req.query, accountSid);
  res.json(searchResults);
});

module.exports = casesRouter;
