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
import { NextFunction, Request, Response } from 'express';

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
profilesRouter.get('/', publicEndpoint, async (req: Request, res: Response) => {
  const { hrmAccountId } = req;
  const {
    sortDirection,
    sortBy,
    limit,
    offset,
    profileFlagIds: encodedProfileFlagIds,
  } = req.query as Record<string, any>; // TODO: maybe improve this validation

  const profileFlagIds = encodedProfileFlagIds
    ? decodeURIComponent(encodedProfileFlagIds)
        .split(',')
        .map(s => parseInt(s, 10))
        .filter(v => v && !isNaN(v))
    : undefined;

  const filters = {
    profileFlagIds,
  };

  const result = await profileController.listProfiles(
    hrmAccountId,
    { sortDirection, sortBy, limit, offset },
    { filters },
  );

  res.json(result);
});

profilesRouter.get(
  '/identifier/:identifier',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId } = req;
    const { identifier } = req.params;

    const result = await profileController.getIdentifierByIdentifier(
      hrmAccountId,
      identifier,
    );

    if (!result) {
      return next(createError(404));
    }

    res.json(result);
  },
);

profilesRouter.get('/identifier/:identifier/flags', publicEndpoint, async (req, res) => {
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
});

profilesRouter.get(
  '/:profileId/contacts',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hrmAccountId, user } = req;
      const { profileId } = req.params;
      const result = await getContactsByProfileId(
        hrmAccountId,
        parseInt(profileId, 10),
        req.query,
        {
          can: req.can,
          user: req.user,
          permissionRules: req.permissionRules,
        },
      );

      console.info(
        `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: contacts for profile read, profile id: ${profileId}`,
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

profilesRouter.get(
  '/:profileId/cases',
  publicEndpoint,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hrmAccountId, can, user, permissionRules } = req;
      const { profileId } = req.params;

      const result = await getCasesByProfileId(
        hrmAccountId,
        parseInt(profileId, 10),
        req.query,
        { can, user, permissionRules },
      );

      console.info(
        `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: cases for profile read, profile id: ${profileId}`,
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

profilesRouter.get('/flags', publicEndpoint, async (req, res) => {
  const { hrmAccountId } = req;
  const result = await profileController.getProfileFlags(hrmAccountId);

  res.json(result);
});

const canAssociate = canPerformActionOnProfileMiddleware(
  actionsMaps.profile.FLAG_PROFILE,
  req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
  }),
);
profilesRouter.post(
  '/:profileId/flags/:profileFlagId',
  canAssociate,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user } = req;
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
      hrmAccountId,
      {
        profileId: parseInt(profileId),
        profileFlagId: parseInt(profileFlagId),
        validUntil: parsedValidUntil,
      },
      { user },
    );

    if (isErr(result)) {
      return next(
        mapHTTPError(result, {
          InvalidParameterError: 400,
          ProfileAlreadyFlaggedError: 409,
        }),
      );
    }

    if (!result.data) {
      return next(createError(404));
    }

    res.json(result.data);
  },
);

const canDisassociate = canPerformActionOnProfileMiddleware(
  actionsMaps.profile.UNFLAG_PROFILE,
  req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
  }),
);
profilesRouter.delete(
  '/:profileId/flags/:profileFlagId',
  canDisassociate,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user, params } = req;
    const { profileId, profileFlagId } = params;

    const result = await profileController.disassociateProfileFromProfileFlag(
      hrmAccountId,
      {
        profileId: parseInt(profileId, 10),
        profileFlagId: parseInt(profileFlagId, 10),
      },
      { user },
    );

    if (!result) {
      return next(createError(404));
    }

    res.json(result);
  },
);

// curl -X POST 'http://localhost:8080/v0/accounts/ACd8a2e89748318adf6ddff7df6948deaf/profiles/5/sections' -H 'Content-Type: application/json' -H "Authorization: Bearer " -d '{
//     "content": "A note bla bla bla",
//     "sectionType": "note"
//   }'

const canCreateProfileSection = canPerformActionOnProfileSectionMiddleware(
  actionsMaps.profileSection.CREATE_PROFILE_SECTION,
  req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: null,
    user: req.user,
  }),
);
profilesRouter.post(
  '/:profileId/sections',
  canCreateProfileSection,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user } = req;
    const { profileId } = req.params;
    const { content, sectionType } = req.body;

    const result = await profileController.createProfileSection(
      hrmAccountId,
      { content, profileId: parseInt(profileId, 10), sectionType },
      { user },
    );

    if (!result) {
      return next(createError(404));
    }

    res.json(result);
  },
);

// curl -X POST 'http://localhost:8080/v0/accounts/ACd8a2e89748318adf6ddff7df6948deaf/profiles/5/sections/5' -H 'Content-Type: application/json' -H "Authorization: Bearer " -d '{
//     "content": "A note bla bla bla",
//   }'
const canEditProfileSection = canPerformActionOnProfileSectionMiddleware(
  actionsMaps.profileSection.EDIT_PROFILE_SECTION,
  req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: parseInt(req.params.sectionId, 10),
    user: req.user,
  }),
);
profilesRouter.patch(
  '/:profileId/sections/:sectionId',
  canEditProfileSection,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user } = req;
    const { profileId, sectionId } = req.params;
    const { content } = req.body;

    const result = await profileController.updateProfileSectionById(
      hrmAccountId,
      {
        profileId: parseInt(profileId, 10),
        sectionId: parseInt(sectionId, 10),
        content,
      },
      { user },
    );

    if (!result) {
      return next(createError(404));
    }

    res.json(result);
  },
);

const canViewProfileSection = canPerformActionOnProfileSectionMiddleware(
  actionsMaps.profileSection.VIEW_PROFILE_SECTION,
  req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    sectionId: parseInt(req.params.sectionId, 10),
    user: req.user,
  }),
);
profilesRouter.get(
  '/:profileId/sections/:sectionId',
  canViewProfileSection,
  async (req: Request, res: Response) => {
    const { hrmAccountId, user } = req;
    const { profileId, sectionId } = req.params;
    const result = await profileController.getProfileSectionById(hrmAccountId, {
      profileId: parseInt(profileId, 10),
      sectionId: parseInt(sectionId, 10),
    });

    console.info(
      `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Profile section read, profile id: ${profileId}, section id: ${sectionId}`,
    );

    if (!result) {
      throw createError(404);
    }

    res.json(result);
  },
);

const canViewProfile = canPerformActionOnProfileMiddleware(
  actionsMaps.profile.VIEW_PROFILE,
  req => ({
    hrmAccountId: req.hrmAccountId,
    can: req.can,
    profileId: parseInt(req.params.profileId, 10),
    user: req.user,
  }),
);
// WARNING: this endpoint MUST be the last one in this router, because it will be used if none of the above regex matches the path
profilesRouter.get(
  '/:profileId',
  canViewProfile,
  async (req: Request, res: Response, next: NextFunction) => {
    const { hrmAccountId, user } = req;
    const { profileId } = req.params;

    const result = await profileController.getProfile()(
      hrmAccountId,
      parseInt(profileId, 10),
    );

    console.info(
      `[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid} Action: profile read, profile id: ${profileId}`,
    );

    if (!result) {
      return next(createError(404));
    }

    res.json(result);
  },
);

export default profilesRouter.expressRouter;
