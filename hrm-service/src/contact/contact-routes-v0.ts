import models from '../models';
import { SafeRouter, publicEndpoint } from '../permissions';
import createError from 'http-errors';
import contactControllerFactory from '../controllers/contact-controller';
import { patchContact } from './contact';
const { Contact } = models;
const ContactController = contactControllerFactory(Contact);

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
  try {
    const updatedContact = await ContactController.connectToCase(
      contactId,
      caseId,
      accountSid,
      user.workerSid,
    );
    res.json(updatedContact);
  } catch (err) {
    if (err.message.includes('violates foreign key constraint')) {
      throw createError(404);
    } else throw err;
  }
});

contactsRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await ContactController.searchContacts(req.body, req.query, accountSid);
  res.json(searchResults);
});

contactsRouter.patch('/:contactId', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;

  const contact = await patchContact(accountSid, user.workerSid, contactId, req.body);
  res.json(contact);
});

export default contactsRouter.expressRouter;
