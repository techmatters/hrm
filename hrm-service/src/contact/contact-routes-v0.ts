import { SafeRouter, publicEndpoint, actionsMaps, User } from '../permissions';
import createError from 'http-errors';
import { patchContact, connectContactToCase, searchContacts, createContact, getContactById, Contact, isS3StoredTranscript } from './contact';
import { asyncHandler } from '../utils';
// eslint-disable-next-line prettier/prettier
import type { Request, Response, NextFunction } from 'express';
import { setupCanForRules } from '../permissions/setupCanForRules';

const contactsRouter = SafeRouter();

const filterExternalTranscripts = (contact: Contact) => ({ ...contact, rawJson: { ...contact.rawJson, conversationMedia: contact.rawJson.conversationMedia?.filter(m => !isS3StoredTranscript(m)) } });

/**
 * In contrast to other permission based functions that are middlewares,
 * this function is applied after the contact records are brought from the DB,
 * stripping certain properties based on the permissions.
 * This rules are defined here so they have better visibility,
 * but this function is "injected" into the business layer that's where we have access to the "raw contact entities".
 */
export const applyContactPermissionsBasedTransformer = (can: ReturnType<typeof setupCanForRules>, user: User) =>  (contact: Contact) => {
  let result: Contact = contact;

  // Filters the external transcript records if user does not have permission on this contact
  if (!can(user, actionsMaps.contact.VIEW_EXTERNAL_TRANSCRIPT, contact)) {
    result = filterExternalTranscripts(result);
  }

  return result;
};

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
contactsRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;

  const contactPermissionsBasedTransformer = applyContactPermissionsBasedTransformer(req.can, user);

  const contact = await createContact(accountSid, user.workerSid, req.body, contactPermissionsBasedTransformer);
  res.json(contact);
});

contactsRouter.put('/:contactId/connectToCase', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;
  const { caseId } = req.body;

  const contactPermissionsBasedTransformer = applyContactPermissionsBasedTransformer(req.can, user);

  try {
    const updatedContact = await connectContactToCase(
      accountSid,
      user.workerSid,
      contactId,
      caseId,
      contactPermissionsBasedTransformer,
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

  const contactPermissionsBasedTransformer = applyContactPermissionsBasedTransformer(req.can, req.user);

  const searchResults = await searchContacts(accountSid, req.body, req.query, contactPermissionsBasedTransformer);
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

  const contactPermissionsBasedTransformer = applyContactPermissionsBasedTransformer(req.can, req.user);

  try {
    const contact = await patchContact(accountSid, user.workerSid, contactId, req.body, contactPermissionsBasedTransformer);
    res.json(contact);
  } catch (err) {
    if (err.message.toLowerCase().includes('contact not found')) {
      throw createError(404);
    } else throw err;
  }
});

export default contactsRouter.expressRouter;
