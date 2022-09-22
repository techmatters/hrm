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
 * @openapi
 * /contacts:
 *   post:
 *     tags:
 *       - Contacts
 *     summary: create a new contact
 *     operationId: createContact
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateContactPayload'
 *       description: Contact to create
 *     responses:
 *       '200':
 *         description: Created contact
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 */
contactsRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;

  const contact = await createContact(accountSid, user.workerSid, req.body);
  res.json(contact);
});


/**
 * @openapi
 * /contacts/{contactId}/connectToCase:
 *   put:
 *     tags:
 *       - Contacts
 *     summary: connect contact to a given case
 *     operationId: connectToCase
 *     parameters:
 *       - name: contactId
 *         in: path
 *         description: ID of contact to connect
 *         required: true
 *         schema:
 *           type: integer
 *           format: int32
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - caseId
 *             properties:
 *               caseId:
 *                 type: integer
 *                 format: int32
 *               example: { 'caseId': 1 }
 *       description: caseId to connect to
 *     responses:
 *       '200':
 *         description: Connected contact to case
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         description: Case or contact not found
 */
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

/**
 * @openapi
 * /contacts/search:
 *   post:
 *     summary: search contacts
 *     operationId: searchContacts
 *     parameters:
 *       - $ref: '#/components/parameters/OrderByColumn'
 *       - $ref: '#/components/parameters/OrderByDirection'
 *       - $ref: '#/components/parameters/Offset'
 *       - $ref: '#/components/parameters/Limit'
 *
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchParameters'
 *       description: Contact to search
 *     responses:
 *       '200':
 *         description: Search contact result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchContact'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 */
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
