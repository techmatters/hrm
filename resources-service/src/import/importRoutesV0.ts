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
import { ImportApiResource, ImportBatch } from './importTypes';
import importService from './importService';
import { AccountSID } from '@tech-matters/twilio-worker-auth';

type ImportRequestBody = {
  importedResources: ImportApiResource[];
  batch: ImportBatch;
};

const importRoutes = () => {
  const router: IRouter = Router();

  const { upsertResources } = importService();

  router.post('/import', async ({ body, accountSid }, res) => {
    const { importedResources, batch }: ImportRequestBody = body;
    res.json(await upsertResources(accountSid as AccountSID, importedResources, batch));
  });

  return router;
};
export default importRoutes;
