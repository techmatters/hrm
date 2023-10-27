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

import { isErr } from '@tech-matters/types';
import createError from 'http-errors';

import { SafeRouter, publicEndpoint } from '../permissions';
import { getProfileContacts, getProfilesByIdentifier, getProfile } from './profile';
import { getCasesByProfileId } from '../case/case';

const profilesRouter = SafeRouter();

profilesRouter.get('/identifier/:identifier', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { identifier } = req.params;

    const result = await getProfilesByIdentifier(accountSid, identifier);

    if (isErr(result)) {
      return next(createError(result.statusCode, result.message));
    }

    if (!result.data) {
      return next(createError(404));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

profilesRouter.get('/:profileId/contacts', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { profileId } = req.params;

    // const result = await getContactsByProfileId(accountSid, profileId, req.query, {
    //   can: req.can,
    //   user: req.user,
    //   searchPermissions: req.searchPermissions,
    // });

    const result = await getProfileContacts(accountSid, profileId, req.query);

    if (isErr(result)) {
      return next(createError(result.statusCode, result.message));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

profilesRouter.get('/:profileId/cases', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { profileId } = req.params;

    const result = await getCasesByProfileId(accountSid, profileId, req.query, {
      can: req.can,
      user: req.user,
      searchPermissions: req.searchPermissions,
    });

    if (isErr(result)) {
      return next(createError(result.statusCode, result.message));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

profilesRouter.get('/:profileId', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { profileId } = req.params;

    const result = await getProfile(accountSid, profileId);

    if (isErr(result)) {
      return next(createError(result.statusCode, result.message));
    }

    if (!result.data) {
      return next(createError(404));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

export default profilesRouter.expressRouter;
