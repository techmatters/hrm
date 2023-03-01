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

import { publicEndpoint, SafeRouter } from '../permissions';
import { Request, Response } from 'express';
import { createReferral } from './referral-model';
import { DuplicateReferralError, OrphanedReferralError, Referral } from './referral-data-access';
import createError from 'http-errors';
import { isValid, parseISO } from 'date-fns';

export default () => {
  const referralsRouter = SafeRouter();

  referralsRouter.post(
    '/',
    publicEndpoint,
    async (req: Request<unknown, Referral, Referral>, res: Response) => {
      const { accountSid, body } = req;
      if (!body.resourceId || !body.contactId || !isValid(parseISO(body.referredAt))) {
        throw createError(400, 'Required referral property not present');
      }
      try {
        res.json(await createReferral(accountSid, body));
      } catch (err) {
        if (err instanceof DuplicateReferralError) {
          throw createError(400, err.message);
        }
        if (err instanceof OrphanedReferralError) {
          throw createError(404, err.message);
        }
        throw err;
      }
    },
  );
  return referralsRouter.expressRouter;
};
