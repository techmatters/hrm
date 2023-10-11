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

  const contact = await createContact(accountSid, user.workerSid, req.body, {
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

      if (can(user, actionsMaps.contact.EDIT_CONTACT, contactObj)) {
        req.authorize();
      } else {
        req.unauthorize();
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

    try {
      const contact = await patchContact(
        accountSid,
        user.workerSid,
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
