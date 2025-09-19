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
import { HrmAccountId } from '@tech-matters/types';
import { ImportRequestBody } from '@tech-matters/resources-types';
import importService, { isValidationFailure } from './importService';
import createError from 'http-errors';

const importRoutes = () => {
  const router: IRouter = Router();

  const { upsertResources, readImportProgress } = importService();

  router.post('/import', async ({ body, hrmAccountId }, res) => {
    const { importedResources, batch }: ImportRequestBody = body;
    const result = await upsertResources(
      hrmAccountId as HrmAccountId,
      importedResources,
      batch,
    );
    if (isValidationFailure(result)) {
      res.status(400).json(result);
    } else {
      res.json(result);
    }
  });

  router.get('/import/progress', async ({ hrmAccountId }, res) => {
    const progress = await readImportProgress(hrmAccountId as HrmAccountId);
    if (progress) {
      res.json(progress);
    } else {
      throw createError(404, {
        message:
          "No import progress found, it's possible that no import has been started yet.",
      });
    }
  });

  return router;
};
export default importRoutes;
