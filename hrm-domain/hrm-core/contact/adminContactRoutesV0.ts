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

import type { Request, Response, NextFunction } from 'express';
import {
  ManuallyTriggeredNotificationOperation,
  manuallyTriggeredNotificationOperations,
} from '@tech-matters/hrm-types';
import { publicEndpoint, SafeRouter } from '../permissions';
import { processContactsStream } from './contactsNotifyService';
import { connectContactToCase, createContact } from './contactService';
import createError from 'http-errors';

const adminContactsRouter = SafeRouter();

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/admin/v0/accounts/ACxxx/contacts -d'{"createdBy": "system", ...}'
adminContactsRouter.post('/', publicEndpoint, async (req: Request, res: Response) => {
  const { hrmAccountId, user, body, permissionRules } = req;
  const contact = await createContact(hrmAccountId, body.createdBy, body, {
    permissionRules,
    can: req.can,
    user,
  });
  res.json(contact);
});

adminContactsRouter.put(
  '/:contactId/connectToCase',
  publicEndpoint,
  async (req: Request, res: Response) => {
    const { hrmAccountId, user, permissionRules } = req;
    const { contactId } = req.params;
    const { caseId } = req.body;
    try {
      const updatedContact = await connectContactToCase(hrmAccountId, contactId, caseId, {
        can: req.can,
        user,
        permissionRules,
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

// admin POST endpoint to reindex contacts. req body has accountSid, dateFrom, dateTo
adminContactsRouter.post(
  '/:notifyOperation',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const notifyOperation = req.params
      .notifyOperation as ManuallyTriggeredNotificationOperation;
    if (!manuallyTriggeredNotificationOperations.includes(notifyOperation)) {
      throw createError(404);
    }
    console.info(`.......${notifyOperation}ing contacts......`, req, res);

    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const resultStream = await processContactsStream(
      hrmAccountId,
      dateFrom,
      dateTo,
      notifyOperation,
    );
    resultStream.on('error', err => {
      next(err);
    });
    res.status(200).setHeader('Content-Type', 'text/plain');
    resultStream.pipe(res);
  },
);

export default adminContactsRouter.expressRouter;
