const models = require('../../models');
const { SafeRouter, publicEndpoint } = require('../../permissions');

const { Contact, Case, sequelize } = models;
const ContactController = require('../../controllers/contact-controller')(Contact);
const CaseController = require('../../controllers/case-controller')(Case, sequelize);

const contactsRouter = SafeRouter();

contactsRouter.get('/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const contacts = await ContactController.getContacts(req.query, accountSid);
  res.json(contacts);
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
contactsRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;

  const contact = await ContactController.createContact(req.body, accountSid, user.workerSid);
  res.json(contact);
});

contactsRouter.put('/:contactId/connectToCase', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;
  const { caseId } = req.body;
  await CaseController.getCase(caseId, accountSid);
  const updatedContact = await ContactController.connectToCase(
    contactId,
    caseId,
    accountSid,
    user.workerSid,
  );
  res.json(updatedContact);
});

contactsRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await ContactController.searchContacts(req.body, req.query, accountSid);
  res.json(searchResults);
});

module.exports = contactsRouter.expressRouter;
