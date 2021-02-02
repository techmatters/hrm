// const { Router } = require('express');
const models = require('../../models');
const { SafeRouter } = require('../../permissions');

const { Contact, Case, CaseAudit, sequelize } = models;
const ContactController = require('../../controllers/contact-controller')(Contact);
const CaseController = require('../../controllers/case-controller')(Case, sequelize);
const CaseAuditController = require('../../controllers/case-audit-controller')(CaseAudit);
const { can } = require('../../permissions');
const { asyncHandler } = require('../../utils');

/**
 * This middleware checks if the user can edit the case.
 * If yes, it sets the req.authorized to true.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const creatorCanEditCase = async (req, res, next) => {
  if (!req.authorized) {
    const { id } = req.params;
    const caseObj = await CaseController.getCase(id);
    const canEdit = can(req.user, 'edit', caseObj);

    if (canEdit) {
      req.authorized = true;
    }
  }

  next();
};

/**
 * A fake middleware that just marks the request as authorized.
 * This can be deleted after we have all authorization middlewares set
 * for all enpoints.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const fakeAuthorized = (req, res, next) => {
  req.authorized = true;
  next();
};

const casesRouter = SafeRouter();

casesRouter.get('/', fakeAuthorized, async (req, res) => {
  const cases = await CaseController.listCases(req.query);
  res.json(cases);
});

casesRouter.post('/', fakeAuthorized, async (req, res) => {
  const { accountSid } = req;

  const createdCase = await CaseController.createCase(req.body, accountSid);
  res.json(createdCase);
});

/**
 * We use asyncHandler(fn) here because expressJS expects the middleware to be a synchronous function,
 * but creatorCanEditCase(args) is asynchronous
 * */
casesRouter.put('/:id', asyncHandler(creatorCanEditCase), async (req, res) => {
  const { id } = req.params;
  const updatedCase = await CaseController.updateCase(id, req.body);
  res.json(updatedCase);
});

casesRouter.delete('/:id', fakeAuthorized, async (req, res) => {
  const { id } = req.params;
  await CaseController.deleteCase(id);
  res.sendStatus(200);
});

casesRouter.get('/:caseId/activities/', fakeAuthorized, async (req, res) => {
  const { caseId } = req.params;
  await CaseController.getCase(caseId);
  const caseAudits = await CaseAuditController.getAuditsForCase(caseId);
  const contactIds = CaseAuditController.getContactIdsFromCaseAudits(caseAudits);
  const relatedContacts = await ContactController.getContactsById(contactIds);
  const activities = await CaseAuditController.getActivities(caseAudits, relatedContacts);

  res.json(activities);
});

casesRouter.post('/search', fakeAuthorized, async (req, res) => {
  const searchResults = await CaseController.searchCases(req.body, req.query);
  res.json(searchResults);
});

module.exports = casesRouter.expressRouter;
