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
import { referenceAttributeService } from './referenceAttributeService';
import { AccountSID } from '@tech-matters/types';

const referenceAttributeRoutes = () => {
  const router: IRouter = Router();
  const { getResourceReferenceAttributeList } = referenceAttributeService();

  router.get('/*', async (req, res) => {
    const { valueStartsWith, language } = req.query;
    const list = (req as any).params[0];
    const result = await getResourceReferenceAttributeList(
      req.hrmAccountId as AccountSID,
      list,
      language as string,
      valueStartsWith as string,
    );
    res.json(result);
  });

  return router;
};
export default referenceAttributeRoutes;
