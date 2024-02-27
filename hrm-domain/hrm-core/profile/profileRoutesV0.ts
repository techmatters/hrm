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

import { isErr, mapHTTPError } from '@tech-matters/types';
import createError from 'http-errors';
import { isValid, parseISO } from 'date-fns';

import { SafeRouter, actionsMaps, publicEndpoint } from '../permissions';
import * as profileController from './profileService';
import { getContactsByProfileId } from '../contact/contactService';
import { getCasesByProfileId } from '../case/caseService';
import {
  canPerformActionOnProfileMiddleware,
  canPerformActionOnProfileSectionMiddleware,
} from './canPerformProfileAction';

const profilesRouter = SafeRouter();

/**
 * Returns a filterable list of cases for a helpline
 *
 * @param {string} req.accountSid - SID of the helpline
 * @param {profileController.ProfileListConfiguration['sortDirection']} req.query.sortDirection - Sort direction
 * @param {profileController.ProfileListConfiguration['sortBy']} req.query.sortBy - Sort by
 * @param {profileController.ProfileListConfiguration['limit']} req.query.limit - Limit
 * @param {profileController.ProfileListConfiguration['offset']} req.query.offset - Offset
 * @param {profileController.SearchParameters['filters']['profileFlagIds']} req.query.profileFlagIds
 */
profilesRouter.get('/', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { sortDirection, sortBy, limit, offset, ...rest } = req.query;

    const profileFlagIds = rest.profileFlagIds
      ? decodeURIComponent(rest.profileFlagIds)
          .split(',')
          .map(s => parseInt(s, 10))
          .filter(v => v && !isNaN(v))
      : undefined;

    const filters = {
      profileFlagIds,
    };

    const result = await profileController.listProfiles(
      accountSid,
      { sortDirection, sortBy, limit, offset },
      { filters },
    );

    if (isErr(result)) {
      return next(mapHTTPError(result, { InternalServerError: 500 }));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

profilesRouter.get('/identifier/:identifier', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { identifier } = req.params;

    const result = await profileController.getIdentifierByIdentifier(
      accountSid,
      identifier,
    );

    if (isErr(result)) {
      return next(mapHTTPError(result, { InternalServerError: 500 }));
    }

    if (!result.data) {
      return next(createError(404));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

profilesRouter.get(
  '/identifier/:identifier/flags',
  publicEndpoint,
  async (req, res, next) => {
    try {
      const { accountSid } = req;
      const { identifier } = req.params;

      const result = await profileController.getProfileFlagsByIdentifier(
        accountSid,
        identifier,
      );

      if (isErr(result)) {
        return next(mapHTTPError(result, { InternalServerError: 500 }));
      }

      res.json(result.data);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

profilesRouter.get('/:profileId/contacts', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { profileId } = req.params;

    const result = await getContactsByProfileId(accountSid, profileId, req.query, {
      can: req.can,
      user: req.user,
      permissions: req.permissions,
    });

    if (isErr(result)) {
      return next(mapHTTPError(result, { InternalServerError: 500 }));
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

    const result = await getCasesByProfileId(accountSid, profileId, req.query, req);

    if (isErr(result)) {
      return next(mapHTTPError(result, { InternalServerError: 500 }));
    }

    res.json(result.data);
  } catch (err) {
    return next(createError(500, err.message));
  }
});

profilesRouter.get('/flags', publicEndpoint, async (req, res, next) => {
  try {
    const { accountSid } = req;

    const result = await profileController.getProfileFlags(accountSid);

    if (isErr(result)) {
      return next(mapHTTPError(result, { InternalServerError: 500 }));
    }

    res.json(result.data);
  } catch (err) {
    console.error(err);
    return next(createError(500, err.message));
  }
});

const canAssociate = canPerformActionOnProfileMiddleware(
  actionsMaps.profile.FLAG_PROFILE,
  req => ({
    accountSid: req.accountSid,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
  }),
);
profilesRouter.post(
  '/:profileId/flags/:profileFlagId',
  canAssociate,
  async (req, res, next) => {
    try {
      const { accountSid } = req;
      const { profileId, profileFlagId } = req.params;
      const { validUntil } = req.body;

      if (validUntil && !Date.parse(validUntil)) {
        return next(createError(400));
      }

      const parsedValidUntil = validUntil ? parseISO(validUntil) : null;

      if (validUntil && !isValid(parsedValidUntil)) {
        return next(createError(400));
      }

      const result = await profileController.associateProfileToProfileFlag(
        accountSid,
        profileId,
        profileFlagId,
        parsedValidUntil,
      );

      if (isErr(result)) {
        return next(
          mapHTTPError(result, { InvalidParameterError: 400, InternalServerError: 500 }),
        );
      }

      if (!result.data) {
        return next(createError(404));
      }

      res.json(result.data);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

const canDisassociate = canPerformActionOnProfileMiddleware(
  actionsMaps.profile.UNFLAG_PROFILE,
  req => ({
    accountSid: req.accountSid,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
  }),
);
profilesRouter.delete(
  '/:profileId/flags/:profileFlagId',
  canDisassociate,
  async (req, res, next) => {
    try {
      const { accountSid } = req;
      const { profileId, profileFlagId } = req.params;

      const result = await profileController.disassociateProfileFromProfileFlag(
        accountSid,
        profileId,
        profileFlagId,
      );

      if (isErr(result)) {
        return next(mapHTTPError(result, { InternalServerError: 500 }));
      }

      if (!result.data) {
        return next(createError(404));
      }

      res.json(result.data);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

// curl -X POST 'http://localhost:8080/v0/accounts/ACd8a2e89748318adf6ddff7df6948deaf/profiles/5/sections' -H 'Content-Type: application/json' -H "Authorization: Bearer " -d '{
//     "content": "A note bla bla bla",
//     "sectionType": "note"
//   }'

const canCreateProfileSection = canPerformActionOnProfileSectionMiddleware(
  actionsMaps.profileSection.CREATE_PROFILE_SECTION,
  req => ({
    accountSid: req.accountSid,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: null,
    user: req.user,
  }),
);
profilesRouter.post(
  '/:profileId/sections',
  canCreateProfileSection,
  async (req, res, next) => {
    try {
      const { accountSid, user } = req;
      const { profileId } = req.params;
      const { content, sectionType } = req.body;

      const result = await profileController.createProfileSection(
        accountSid,
        { content, profileId, sectionType },
        { user },
      );

      if (isErr(result)) {
        return next(mapHTTPError(result, { InternalServerError: 500 }));
      }

      if (!result.data) {
        return next(createError(404));
      }

      res.json(result.data);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

// curl -X POST 'http://localhost:8080/v0/accounts/ACd8a2e89748318adf6ddff7df6948deaf/profiles/5/sections/5' -H 'Content-Type: application/json' -H "Authorization: Bearer " -d '{
//     "content": "A note bla bla bla",
//   }'
const canEditProfileSection = canPerformActionOnProfileSectionMiddleware(
  actionsMaps.profileSection.EDIT_PROFILE_SECTION,
  req => ({
    accountSid: req.accountSid,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: parseInt(req.params.sectionId, 10),
    user: req.user,
  }),
);
profilesRouter.patch(
  '/:profileId/sections/:sectionId',
  canEditProfileSection,
  async (req, res, next) => {
    try {
      const { accountSid, user } = req;
      const { profileId, sectionId } = req.params;
      const { content } = req.body;

      const result = await profileController.updateProfileSectionById(
        accountSid,
        { profileId, sectionId, content },
        { user },
      );

      if (isErr(result)) {
        return next(mapHTTPError(result, { InternalServerError: 500 }));
      }

      if (!result.data) {
        return next(createError(404));
      }

      res.json(result.data);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

const canViewProfileSection = canPerformActionOnProfileSectionMiddleware(
  actionsMaps.profileSection.VIEW_PROFILE_SECTION,
  req => ({
    accountSid: req.accountSid,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: parseInt(req.params.sectionId, 10),
    user: req.user,
  }),
);
profilesRouter.get(
  '/:profileId/sections/:sectionId',
  canViewProfileSection,
  async (req, res, next) => {
    try {
      const { accountSid } = req;
      const { profileId, sectionId } = req.params;

      const result = await profileController.getProfileSectionById(accountSid, {
        profileId,
        sectionId,
      });

      if (isErr(result)) {
        return next(mapHTTPError(result, { InternalServerError: 500 }));
      }

      if (!result.data) {
        return next(createError(404));
      }

      res.json(result.data);
    } catch (err) {
      return next(createError(500, err.message));
    }
  },
);

const canViewProfile = canPerformActionOnProfileMiddleware(
  actionsMaps.profile.VIEW_PROFILE,
  req => ({
    accountSid: req.accountSid,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
  }),
);
// WARNING: this endpoint MUST be the last one in this router, because it will be used if none of the above regex matches the path
profilesRouter.get('/:profileId', canViewProfile, async (req, res, next) => {
  try {
    const { accountSid } = req;
    const { profileId } = req.params;

    const result = await profileController.getProfile()(accountSid, profileId);

    if (isErr(result)) {
      return next(
        mapHTTPError(result, { ProfileNotFoundError: 404, InternalServerError: 500 }),
      );
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
