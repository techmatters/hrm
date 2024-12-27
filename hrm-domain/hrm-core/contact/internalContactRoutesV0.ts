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

import type { Request } from 'express';
import { publicEndpoint, SafeRouter } from '../permissions';
import { createContact } from './contactService';

const internalContactsRouter = SafeRouter();

/**
 * @param {any} req - Request
 * @param {any} res - Response
 * @param {NewContactRecord} req.body - Contact to create
 *
 * @returns {Contact} - Created contact
 */
internalContactsRouter.post(
  '/',
  publicEndpoint,
  async ({ hrmAccountId, user, body, can }: Request, res) => {
    const contact = await createContact(
      hrmAccountId,
      // Take the createdBy specified in the body since this is being created from a backend system
      body.createdBy,
      body,
      {
        can,
        user,
      },
    );
    res.json(contact);
  },
);

export default internalContactsRouter.expressRouter;
