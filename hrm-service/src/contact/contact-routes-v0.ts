import { SafeRouter, publicEndpoint, actionsMaps } from '../permissions';
import createError from 'http-errors';
import { patchContact, connectContactToCase, searchContacts, createContact, getContactById } from './contact';
import { asyncHandler } from '../utils';
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

  const contact = await createContact(accountSid, user.workerSid, req.body, { can: req.can, user });
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
      { can: req.can, user },
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

  const searchResults = await searchContacts(accountSid, req.body, req.query, { can: req.can, user: req.user });
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

    try {
      const contactObj = await getContactById(accountSid, contactId);

      if (can(user, actionsMaps.contact.EDIT_CONTACT, contactObj)) {
        req.authorize();
      } else {
        req.unauthorize();
      }
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('contact not found')) {
        throw createError(404);
      } else {
        throw createError(500);
      }
    }
  }

  next();
});

contactsRouter.patch('/:contactId', validatePatchPayload, canEditContact, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;

  try {
    const contact = await patchContact(accountSid, user.workerSid, contactId, req.body, { can: req.can, user });
    res.json(contact);
  } catch (err) {
    if (err.message.toLowerCase().includes('contact not found')) {
      throw createError(404);
    } else throw err;
  }
});

export default contactsRouter.expressRouter;
