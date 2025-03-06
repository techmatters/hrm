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
import * as profileController from './profileService';
import createError from 'http-errors';

const internalProfileRouter = SafeRouter();

internalProfileRouter.get(
  '/identifier/:identifier/flags',
  publicEndpoint,
  async (req, res) => {
    const { hrmAccountId } = req;
    const { identifier } = req.params;

    const result = await profileController.getProfileFlagsByIdentifier(
      hrmAccountId,
      identifier,
    );

    if (!result) {
      throw createError(404);
    }

    res.json(result);
  },
);

export default internalProfileRouter.expressRouter;
