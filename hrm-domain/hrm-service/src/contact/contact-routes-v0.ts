/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { SafeRouter, publicEndpoint, actionsMaps } from '../permissions';
import createError from 'http-errors';
import {
  patchContact,
  connectContactToCase,
  searchContacts,
  createContact,
  getContactById,
  addConversationMediaToContact,
  getContactByTaskId,
} from './contact';
import asyncHandler from '../async-handler';
import type { Request, Response, NextFunction } from 'express';
import isTwilioTaskTransferTarget from '@tech-matters/twilio-client/isTwilioTaskTransferTarget';
import { getClient } from '@tech-matters/twilio-client/dist';

const contactsRouter = SafeRouter();

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'

/**
 * @param {any} req. - Request
 * @param {any} res - User for requested
 * @param {CreateContactPayload} req.body - Contact to create
 *
 * @returns {Contact} - Created contact
 */
contactsRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const finalize = req.query.finalize !== 'false'; // Default to true for backwards compatibility
  const contact = await createContact(accountSid, user.workerSid, finalize, req.body, {
    can: req.can,
    user,
  });
  res.json(contact);
});

contactsRouter.get('/byTaskSid/:taskSid', publicEndpoint, async (req, res) => {
  const { accountSid, user, can } = req;
  const contact = await getContactByTaskId(accountSid, req.params.taskSid, {
    can: req.can,
    user,
  });
  if (!contact) {
    throw createError(404);
  }
  if (!req.isAuthorized()) {
    if (!can(user, actionsMaps.contact.VIEW_CONTACT, contact)) {
      createError(401);
    }
  }
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

  const searchResults = await searchContacts(accountSid, req.body, req.query, {
    can: req.can,
    user: req.user,
    searchPermissions: req.searchPermissions,
  });
  res.json(searchResults);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const validatePatchPayload = ({ body }: Request, res: Response, next: NextFunction) => {
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw createError(400);
  }

  next();
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const canEditContact = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, user, can } = req;
    const { contactId } = req.params;

    try {
      const contactObj = await getContactById(accountSid, contactId);
      if (contactObj.finalizedAt) {
        if (can(user, actionsMaps.contact.EDIT_CONTACT, contactObj)) {
          req.authorize();
        } else {
          req.unauthorize();
        }
      } else {
        // If there is no finalized date, then the contact is a draft and can only be edited by the worker who created it
        if (contactObj.createdBy === user.workerSid) {
          req.authorize();
        } else {
          // It the contact record doesn't show this user as the contact owner, but Twilio shows that they are having the associated task transferred to them, permit the edit
          // Long term it's wrong for HRM to be verifying this itself - we should probably initiate updates for the contact record from the backend transfer logic rather than Flex in future.
          // Then HRM just needs to validate the request is coming from a valid backend service with permission to make the edit.
          const twilioClient = await getClient({ accountSid });
          if (
            await isTwilioTaskTransferTarget(
              twilioClient,
              res.body?.taskSid,
              contactObj.taskId,
              user.workerSid,
            )
          ) {
            req.authorize();
          } else {
            req.unauthorize();
          }
        }
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes('contact not found')
      ) {
        throw createError(404);
      } else {
        throw createError(500);
      }
    }
  }

  next();
});

contactsRouter.patch(
  '/:contactId',
  validatePatchPayload,
  canEditContact,
  async (req, res) => {
    const { accountSid, user } = req;
    const { contactId } = req.params;
    const finalize = req.query.finalize === 'false'; // Default to false for backwards compatibility
    try {
      const contact = await patchContact(
        accountSid,
        user.workerSid,
        finalize,
        contactId,
        req.body,
        {
          can: req.can,
          user,
        },
      );
      res.json(contact);
    } catch (err) {
      if (err.message.toLowerCase().includes('contact not found')) {
        throw createError(404);
      } else throw err;
    }
  },
);

contactsRouter.post('/:contactId/conversationMedia', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const { contactId } = req.params;

  try {
    const contact = await addConversationMediaToContact(accountSid, contactId, req.body, {
      can: req.can,
      user,
    });
    res.json(contact);
  } catch (err) {
    if (err.message.toLowerCase().includes('contact not found')) {
      throw createError(404);
    } else throw err;
  }
});

export default contactsRouter.expressRouter;
