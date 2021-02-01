const { Router } = require('express');
const models = require('../../models');

const { Contact, Case, CaseAudit, sequelize } = models;
const ContactController = require('../../controllers/contact-controller')(Contact);
const CaseController = require('../../controllers/case-controller')(Case, sequelize);
const CaseAuditController = require('../../controllers/case-audit-controller')(CaseAudit);
const { can } = require('../../permissions');
const { asyncHandler, unauthorized } = require('../../utils');

/**
 * This methods checks if the user can edit the case.
 * If yes, the endpoint code is run.
 * If not, it sends unauthorized.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const editCasePermissions = async (req, res, next) => {
  const { id } = req.params;
  const caseObj = await CaseController.getCase(id);
  const canEdit = can(req.user, 'edit', caseObj);

  return canEdit ? next() : unauthorized(res);
};

const casesRouter = Router();

casesRouter.get('/', async (req, res) => {
  const cases = await CaseController.listCases(req.query);
  res.json(cases);
});

casesRouter.post('/', async (req, res) => {
  const { accountSid } = req;

  const createdCase = await CaseController.createCase(req.body, accountSid);
  res.json(createdCase);
});

/**
 * We use asyncHandler(fn) here because expressJS expects the middleware to be a synchronous function,
 * but editCasePermissions(args) is asynchronous
 * */
casesRouter.put('/:id', asyncHandler(editCasePermissions), async (req, res) => {
  const { id } = req.params;
  const updatedCase = await CaseController.updateCase(id, req.body);
  res.json(updatedCase);
});

casesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await CaseController.deleteCase(id);
  res.sendStatus(200);
});

casesRouter.get('/:caseId/activities/', async (req, res) => {
  const { caseId } = req.params;
  await CaseController.getCase(caseId);
  const caseAudits = await CaseAuditController.getAuditsForCase(caseId);
  const contactIds = CaseAuditController.getContactIdsFromCaseAudits(caseAudits);
  const relatedContacts = await ContactController.getContactsById(contactIds);
  const activities = await CaseAuditController.getActivities(caseAudits, relatedContacts);

  res.json(activities);
});

casesRouter.post('/search', async (req, res) => {
  const searchResults = await CaseController.searchCases(req.body, req.query);
  res.json(searchResults);
});

module.exports = casesRouter;
