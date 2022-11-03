import { SafeRouter, publicEndpoint, actionsMaps } from '../permissions';
import createError from 'http-errors';
import { patchContact, connectContactToCase, searchContacts, createContact } from './contact';
import { asyncHandler } from '../utils';
import { getById } from './contact-data-access';
// eslint-disable-next-line prettier/prettier
import type { Request, Response, NextFunction } from 'express';

const contactsRouter = SafeRouter();

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'

/**
 * @param {string} req.accountSid - SID of the helpline
 * @param {User} req.query.user - User for requested
 * @param {import('./contact').CreateContactPayload} req.body - Contact to create
 *
 * @returns {import('./contact').Contact} - Created contact
 */
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

const validatePatchPayload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.body || !req.body.rawJson) {
    throw createError(400);
  }

  next();
};

const canEditContact = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, user, can } = req;
    const { contactId } = req.params;

    const contactObj = await getById(accountSid, contactId);

    if (!contactObj) throw createError(404);

    if (can(user, actionsMaps.contact.EDIT_CONTACT, contactObj)) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
});


contactsRouter.patch('/:contactId', validatePatchPayload, canEditContact, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;
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
