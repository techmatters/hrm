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

import { actionsMaps, publicEndpoint as openEndpoint, SafeRouter } from '../permissions';
import { isErr, mapHTTPError } from '@tech-matters/types';
import createError from 'http-errors';
import {
  addConversationMediaToContact,
  connectContactToCase,
  createContact,
  getContactById,
  getContactByTaskId,
  patchContact,
  generalisedContactSearch,
} from './contactService';
import type { NextFunction, Request, Response } from 'express';
import {
  canChangeContactConnection,
  canDisconnectContact,
  canPerformEditContactAction,
  canPerformViewContactAction,
} from './canPerformContactAction';

const newContactRouter = (isPublic: boolean) => {
  const contactsRouter = SafeRouter();

  // Public only endpoints
  if (isPublic) {
    contactsRouter.get('/byTaskSid/:taskSid', openEndpoint, async (req, res) => {
      const { hrmAccountId, user, can } = req;
      const { taskSid } = req.params;
      const contact = await getContactByTaskId(hrmAccountId, taskSid, {
        can: req.can,
        user,
      });
      console.info(
        `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Contact read by task sid, taskSid: ${taskSid}`,
      );
      if (!contact || !can(user, actionsMaps.contact.VIEW_CONTACT, contact)) {
        throw createError(404);
      }
      res.json(contact);
    });

    contactsRouter.delete(
      '/:contactId/connectToCase',
      canDisconnectContact,
      async (req, res) => {
        const { hrmAccountId, user } = req;
        const { contactId } = req.params;

        try {
          const deleteContact = await connectContactToCase(
            hrmAccountId,
            contactId,
            null,
            {
              can: req.can,
              user,
            },
          );
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

    const searchHandler = async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { hrmAccountId, can, user, permissionRules, query, body } = req;

        // TODO: use better validation
        const { limit, offset } = query as { limit: string; offset: string };
        const { searchParameters } = body;

        const contactsResponse = await generalisedContactSearch(
          hrmAccountId,
          searchParameters,
          { limit, offset },
          {
            can,
            user,
            permissionRules,
          },
        );

        if (isErr(contactsResponse)) {
          return next(mapHTTPError(contactsResponse, { InternalServerError: 500 }));
        }

        res.json(contactsResponse.data);
      } catch (err) {
        return next(createError(500, err.message));
      }
    };

    // Endpoint used for generalized search powered by ElasticSearch
    contactsRouter.post('/search', openEndpoint, searchHandler);
    contactsRouter.post('/generalizedSearch', openEndpoint, searchHandler);

    contactsRouter.post(
      '/:contactId/conversationMedia',
      openEndpoint,
      async (req, res) => {
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
      },
    );
  }

  // example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
  contactsRouter.post('/', openEndpoint, async (req: Request, res) => {
    const getCreatedBy = ({ body, user }: { user: Request['user']; body: any }) => {
      if (isPublic) {
        // Take the createdBy specified in the body if this is being created from a backend system, otherwise force use of the authenticated user's workerSid
        return user.isSystemUser ? body.createdBy : user.workerSid;
      }

      // Take the createdBy specified in the body since this is being created from a backend system
      return body.createdBy;
    };

    const { hrmAccountId, user, body } = req;
    const contact = await createContact(
      hrmAccountId,
      getCreatedBy({ body, user }),
      body,
      {
        can: req.can,
        user,
      },
    );
    res.json(contact);
  });

  contactsRouter.put(
    '/:contactId/connectToCase',
    isPublic ? canChangeContactConnection : openEndpoint,
    async (req, res) => {
      const { hrmAccountId, user } = req;
      const { contactId } = req.params;
      const { caseId } = req.body;
      try {
        const updatedContact = await connectContactToCase(
          hrmAccountId,
          contactId,
          caseId,
          {
            can: req.can,
            user,
          },
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
    },
  );

  const validatePatchPayload = ({ body }: Request, res: Response, next: NextFunction) => {
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw createError(400);
    }

    next();
  };

  contactsRouter.patch(
    '/:contactId',
    validatePatchPayload,
    isPublic ? canPerformEditContactAction : openEndpoint,
    async (req, res) => {
      const { hrmAccountId, user, permissionRules, permissionCheckContact } = req;
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
            permissionRules,
            permissionCheckContact,
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

  // WARNING: this endpoint MUST be the last one in this router, because it will be used if none of the above regex matches the path
  contactsRouter.get(
    '/:contactId',
    isPublic ? canPerformViewContactAction : openEndpoint,
    async (req, res) => {
      const { hrmAccountId, can, user } = req;

      console.info(
        `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Contact read by task sid, taskSid: ${req.params.contactId}`,
      );
      const contact = await getContactById(hrmAccountId, req.params.contactId, {
        can: req.can,
        user,
      });
      if (!contact) {
        throw createError(404);
      }
      if (!req.isPermitted()) {
        if (!can(user, actionsMaps.contact.VIEW_CONTACT, contact)) {
          createError(401);
        }
      }
      res.json(contact);
    },
  );

  return contactsRouter.expressRouter;
};

export default newContactRouter;
