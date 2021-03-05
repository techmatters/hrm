const models = require('../../models');
const { SafeRouter, openEndpoint } = require('../../permissions');

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

const casesRouter = SafeRouter();

casesRouter.get('/', openEndpoint, async (req, res) => {
  const { accountSid } = req;
  const cases = await CaseController.listCases(req.query, accountSid);
  res.json(cases);
});

casesRouter.post('/', openEndpoint, async (req, res) => {
  const { accountSid } = req;

  const createdCase = await CaseController.createCase(req.body, accountSid);
  res.json(createdCase);
});

/**
 * We use asyncHandler(fn) here because expressJS expects the middleware to be a synchronous function,
 * but creatorCanEditCase(args) is asynchronous
 * */
casesRouter.put('/:id', asyncHandler(creatorCanEditCase), async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  const updatedCase = await CaseController.updateCase(id, req.body, accountSid);
  res.json(updatedCase);
});

casesRouter.delete('/:id', openEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  await CaseController.deleteCase(id, accountSid);
  res.sendStatus(200);
});

casesRouter.get('/:caseId/activities/', openEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { caseId } = req.params;
  await CaseController.getCase(caseId, accountSid);
  const caseAudits = await CaseAuditController.getAuditsForCase(caseId, accountSid);
  const contactIds = CaseAuditController.getContactIdsFromCaseAudits(caseAudits);
  const relatedContacts = await ContactController.getContactsById(contactIds, accountSid);
  const activities = await CaseAuditController.getActivities(caseAudits, relatedContacts);

  res.json(activities);
});

casesRouter.post('/search', openEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await CaseController.searchCases(req.body, req.query, accountSid);
  res.json(searchResults);
});

module.exports = casesRouter.expressRouter;
