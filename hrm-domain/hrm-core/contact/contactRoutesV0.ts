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

import { actionsMaps, publicEndpoint, SafeRouter } from '../permissions';
import { isErr, mapHTTPError } from '@tech-matters/types';
import createError from 'http-errors';
import {
  addConversationMediaToContact,
  connectContactToCase,
  createContact,
  getContactById,
  getContactByTaskId,
  patchContact,
  searchContacts,
  searchContactsByIdCtx,
} from './contactService';
import type { NextFunction, Request, Response } from 'express';
import {
  canChangeContactConnection,
  canDisconnectContact,
  canPerformEditContactAction,
  canPerformViewContactAction,
} from './canPerformContactAction';

const contactsRouter = SafeRouter();

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'

/**
 * @param {any} req. - Request
 * @param {any} res - User for requested
 * @param {NewContactRecord} req.body - Contact to create
 *
 * @returns {Contact} - Created contact
 */
contactsRouter.post('/', publicEndpoint, async (req, res) => {
  const { hrmAccountId, user } = req;
  const contact = await createContact(hrmAccountId, user.workerSid, req.body, {
    can: req.can,
    user,
  });
  res.json(contact);
});

contactsRouter.get('/byTaskSid/:taskSid', publicEndpoint, async (req, res) => {
  const { hrmAccountId, user, can } = req;
  const contact = await getContactByTaskId(hrmAccountId, req.params.taskSid, {
    can: req.can,
    user,
  });
  if (!contact || !can(user, actionsMaps.contact.VIEW_CONTACT, contact)) {
    throw createError(404);
  }
  res.json(contact);
});

contactsRouter.put(
  '/:contactId/connectToCase',
  canChangeContactConnection,
  async (req, res) => {
    const { hrmAccountId, user } = req;
    const { contactId } = req.params;
    const { caseId } = req.body;
    try {
      const updatedContact = await connectContactToCase(hrmAccountId, contactId, caseId, {
        can: req.can,
        user,
      });
      res.json(updatedContact);
    } catch (err) {
      if (
        err.message.toLowerCase().includes('violates foreign key constraint') ||
        err.message.toLowerCase().includes('contact not found')
      ) {
        throw createError(404);
      } else throw err;
    }
  },
);

contactsRouter.delete(
  '/:contactId/connectToCase',
  canDisconnectContact,
  async (req, res) => {
    const { hrmAccountId, user } = req;
    const { contactId } = req.params;

    try {
      const deleteContact = await connectContactToCase(hrmAccountId, contactId, null, {
        can: req.can,
        user,
      });
      res.json(deleteContact);
    } catch (err) {
      if (
        err.message.toLowerCase().includes('violates foreign key constraint') ||
        err.message.toLowerCase().includes('contact not found')
      ) {
        throw createError(404);
      } else throw err;
    }
  },
);

// Legacy Search endpoint
contactsRouter.post('/search', publicEndpoint, async (req, res) => {
  const { hrmAccountId } = req;

  const searchResults = await searchContacts(hrmAccountId, req.body, req.query, {
    can: req.can,
    user: req.user,
    permissions: req.permissions,
  });
  res.json(searchResults);
});

// Endpoint used for generalized search with ElasticSearch
contactsRouter.post(
  '/searchV2',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const { hrmAccountId, params, can, user, permissions, query } = req;

      // console.log('params', params); //params will have filters - counsellor, dateFrom, dateTo which will be applied by the ES client
      // mocked ES client results with an array of Ids for testing - currently not implemented
      const contacts = [
        { id: 660 },
        { id: 659 },
        { id: 658 },
        { id: 657 },
        { id: 656 },
        { id: 655 },
        { id: 653 },
        { id: 654 },
        { id: 652 },
        { id: 651 },
        { id: 650 },
        { id: 649 },
        { id: 648 },
        { id: 646 },
        { id: 645 },
        { id: 625 },
        { id: 644 },
        { id: 643 },
        { id: 641 },
        { id: 640 },
        { id: 639 },
        { id: 637 },
        { id: 636 },
        { id: 635 },
        { id: 634 },
        { id: 633 },
        { id: 632 },
        { id: 631 },
        { id: 630 },
        { id: 629 },
        { id: 628 },
        { id: 627 },
        { id: 626 },
        { id: 624 },
        { id: 623 },
      ];

      const elasticSearchClient = async () => ({ contacts, count: contacts.length });
      const esContactIdsResult = await elasticSearchClient();

      res.json(esContactIdsResult);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

contactsRouter.post(
  '/searchByIds',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hrmAccountId, can, user, permissions, query, body } = req;
      const { ids } = body;

      const contactsResponse = await searchContactsByIdCtx(hrmAccountId, ids, query, {
        can,
        user,
        permissions,
      });

      if (isErr(contactsResponse)) {
        return next(mapHTTPError(contactsResponse, { InternalServerError: 500 }));
      }

      res.json(contactsResponse.data);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const validatePatchPayload = ({ body }: Request, res: Response, next: NextFunction) => {
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw createError(400);
  }

  next();
};

contactsRouter.patch(
  '/:contactId',
  validatePatchPayload,
  canPerformEditContactAction,
  async (req, res) => {
    const { hrmAccountId, user } = req;
    const { contactId } = req.params;
    const finalize = req.query.finalize === 'true'; // Default to false for backwards compatibility
    try {
      const contact = await patchContact(
        hrmAccountId,
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
  const { hrmAccountId, user } = req;
  const { contactId } = req.params;

  try {
    const contact = await addConversationMediaToContact(
      hrmAccountId,
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
});

// WARNING: this endpoint MUST be the last one in this router, because it will be used if none of the above regex matches the path
contactsRouter.get('/:contactId', canPerformViewContactAction, async (req, res) => {
  const { hrmAccountId, can, user } = req;
  const contact = await getContactById(hrmAccountId, req.params.contactId, {
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

export default contactsRouter.expressRouter;
