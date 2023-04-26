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

import { IRouter, Router } from 'express';
import { ImportRequestBody } from '@tech-matters/types';
import importService, { isValidationFailure } from './importService';
import { AccountSID } from '@tech-matters/twilio-worker-auth';

const importRoutes = () => {
  const router: IRouter = Router();

  const { upsertResources } = importService();

  router.post('/import', async ({ body, accountSid }, res) => {
    const { importedResources, batch }: ImportRequestBody = body;
    const result = await upsertResources(accountSid as AccountSID, importedResources, batch);
    if (isValidationFailure(result)) {
      res.status(400).json(result);
    }
    res.json(result);
  });

  return router;
};
export default importRoutes;
