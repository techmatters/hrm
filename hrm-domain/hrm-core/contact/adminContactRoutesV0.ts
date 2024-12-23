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
import { SafeRouter } from '../permissions';
import { processContactsStream } from './contactsNotifyService';
import { createContact } from './contactService';
import {
  adminAuthorizationMiddleware,
  staticKeyAuthorizationMiddleware,
} from '@tech-matters/twilio-worker-auth';

const adminContactsRouter = SafeRouter();

// admin POST endpoint to reindex contacts. req body has accountSid, dateFrom, dateTo
adminContactsRouter.post(
  '/reindex',
  adminAuthorizationMiddleware('ADMIN_HRM'),
  async (req: Request, res: Response, next: NextFunction) => {
    console.log('.......reindexing contacts......', req, res);

    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const resultStream = await processContactsStream(
      hrmAccountId,
      dateFrom,
      dateTo,
      'reindex',
    );
    resultStream.on('error', err => {
      next(err);
    });
    res.status(200).setHeader('Content-Type', 'text/plain');
    resultStream.pipe(res);
  },
);

adminContactsRouter.post(
  '/republish',
  adminAuthorizationMiddleware('ADMIN_HRM'),
  async (req: Request, res: Response, next: NextFunction) => {
    console.log('.......republishing contacts......', req, res);
    const { hrmAccountId } = req;
    const { dateFrom, dateTo } = req.body;

    const resultStream = await processContactsStream(
      hrmAccountId,
      dateFrom,
      dateTo,
      'republish',
    );
    resultStream.on('error', err => {
      next(err);
    });
    res.status(200).setHeader('Content-Type', 'text/plain');
    resultStream.pipe(res);
  },
);

/**
 * @param {any} req - Request
 * @param {any} res - Response
 * @param {NewContactRecord} req.body - Contact to create
 *
 * @returns {Contact} - Created contact
 */
adminContactsRouter.post(
  '/',
  staticKeyAuthorizationMiddleware,
  async (req: Request, res) => {
    const { hrmAccountId, user, body } = req;
    const contact = await createContact(
      hrmAccountId,
      // Take the createdBy specified in the body since this is being created from a backend system
      body.createdBy,
      body,
      {
        can: req.can,
        user,
      },
    );
    res.json(contact);
  },
);

export default adminContactsRouter.expressRouter;
