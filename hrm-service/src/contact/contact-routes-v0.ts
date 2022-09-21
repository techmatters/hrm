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
 *     parameters:
 *       - name: rawJson
 *         in: body
 *         description: Raw contact form object
 *         required: true
 *         schema:
 *           type: object
 *           example:
 *             {
 *               'callType': {},
 *               'callerInformation': {},
 *               'childInformation': {},
 *               'caseInformation': {},
 *             }
 *       - name: queueName
 *         in: body
 *         description: Name of the queue where this contact was taken
 *         schema:
 *           type: string
 *           example: Admin
 *       - name: twilioWorkerId
 *         in: body
 *         description: Id of the Twilio worker that took the contact
 *         schema:
 *           type: string
 *           example: WZd3d289370720216aab7e3dc023e80f5f
 *       - name: helpline
 *         in: body
 *         description: Helpline where the contact took place
 *         schema:
 *           type: string
 *           example: Toronto Line
 *       - name: number
 *         in: body
 *         description: Number of the caller for this contact
 *         schema:
 *           type: string
 *           example: '+12025550163'
 *       - name: channel
 *         in: body
 *         description: Channel where this contact took place
 *         schema:
 *           type: string
 *           example: 'web'
 *       - name: conversationDuration
 *         in: body
 *         description: Duration in seconds of this contact
 *         schema:
 *           type: integer
 *           format: int32
 *           example: 42
 *       - name: accountSid
 *         in: body
 *         description: Id of the Twilio account that took the contact
 *         schema:
 *           type: string
 *           example: ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 *       - name: timeOfContact
 *         in: body
 *         description: Date-time of the contact (EPOCH timestamp)
 *         schema:
 *           type: integer
 *           format: int32
 *           example: 1565827981000
 *     responses:
 *       '200':
 *         description: Created contact
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SequelizeRecord'
 *                 - $ref: '#/components/schemas/Contact'
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
 *               allOf:
 *                 - $ref: '#/components/schemas/SequelizeRecord'
 *                 - $ref: '#/components/schemas/Contact'
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
 *     tags:
 *       - Contacts
 *     summary: search contacts
 *     operationId: searchContacts
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           format: int32
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           format: int32
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchParameters'
 *       description: Case to create
 *     responses:
 *       '200':
 *         description: Search contacts result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchContactsResult'
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
