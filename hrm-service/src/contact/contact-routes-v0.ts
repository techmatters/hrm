import { SafeRouter, publicEndpoint } from '../permissions';
import createError from 'http-errors';
import { patchContact, connectContactToCase, searchContacts, createContact } from './contact';

const contactsRouter = SafeRouter();

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
contactsRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;

  const contact = await createContact(accountSid, user.workerSid, req.body);
  res.json(contact);
});

contactsRouter.put('/:contactId/connectToCase', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;
  const { caseId } = req.body;
  try {
    const updatedContact = await connectContactToCase(
      accountSid,
      user.workerSid,
      contactId,
      caseId,
    );
    res.json(updatedContact);
  } catch (err) {
    if (
      err.message.toLowerCase().includes('violates foreign key constraint') ||
      err.message.toLowerCase().includes('contact not found')
    ) {
      throw createError(404);
    } else throw err;
  }
});

contactsRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await searchContacts(accountSid, req.body, req.query);
  res.json(searchResults);
});

contactsRouter.patch('/:contactId', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;
  if (!req.body || !req.body.rawJson) {
    throw createError(400);
  }
  try {
    const contact = await patchContact(accountSid, user.workerSid, contactId, req.body);
    res.json(contact);
  } catch (err) {
    if (err.message.toLowerCase().includes('contact not found')) {
      throw createError(404);
    } else throw err;
  }
});

export default contactsRouter.expressRouter;
