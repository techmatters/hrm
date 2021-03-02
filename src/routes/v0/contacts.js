const { Router } = require('express');
const models = require('../../models');

const { sequelize } = models.default;
const { Contact, Case } = sequelize.models;
const ContactController = require('../../controllers/contact-controller')(Contact);
const CaseController = require('../../controllers/case-controller')(Case, sequelize);

const contactsRouter = Router();

contactsRouter.get('/', async (req, res) => {
  const contacts = await ContactController.getContacts(req.query);
  res.json(contacts);
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
contactsRouter.post('/', async (req, res) => {
  const { accountSid } = req;

  const contact = await ContactController.createContact(req.body, accountSid);
  res.json(contact);
});

contactsRouter.put('/:contactId/connectToCase', async (req, res) => {
  const { contactId } = req.params;
  const { caseId } = req.body;
  await CaseController.getCase(caseId);
  const updatedContact = await ContactController.connectToCase(contactId, caseId);
  res.json(updatedContact);
});

contactsRouter.post('/search', async (req, res) => {
  const searchResults = await ContactController.searchContacts(req.body, req.query);
  res.json(searchResults);
});

module.exports = contactsRouter;
