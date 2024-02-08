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

import createError from 'http-errors';
import { isErr, mapHTTPError } from '@tech-matters/types';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import asyncHandler from '../async-handler';
import { getProfile as getProfileById, getProfileSectionById } from './profileService';
import type { Profile, ProfileSection } from './profileDataAccess';
import type { RequestWithPermissions } from '../permissions';
import type { InitializedCan } from '../permissions/initializeCanForRules';
import type { ActionsForTK } from '../permissions/actions';

export const canPerformActionOnProfile = (
  action: ActionsForTK<'profile'>,
  parseRequest: (req: RequestWithPermissions) => {
    accountSid: string;
    can: InitializedCan;
    profileId: Profile['id'];
    user: TwilioUser;
  },
) =>
  asyncHandler(async (req, _res, next) => {
    const { accountSid, can, profileId, user } = parseRequest(req);
    const result = await getProfileById()(accountSid, profileId);

    if (isErr(result)) {
      return next(
        mapHTTPError(result, { ProfileNotFoundError: 404, InternalServerError: 500 }),
      );
    }

    const isAllowed = can(user, action, result.data);

    if (isAllowed) {
      req.authorize();
    } else {
      req.unauthorize();
    }

    next();
  });

export const canPerformActionOnProfileSection = (
  action: ActionsForTK<'profileSection'>,
  parseRequest: (req: RequestWithPermissions) => {
    accountSid: string;
    can: InitializedCan;
    profileId: Profile['id'];
    sectionId: ProfileSection['id'] | null;
    user: TwilioUser;
  },
) =>
  asyncHandler(async (req, _res, next) => {
    const { accountSid, can, profileId, sectionId, user } = parseRequest(req);

    if (sectionId === null && action === 'createProfileSection') {
      const isAllowed = can(user, action, null);

      if (isAllowed) {
        req.authorize();
      } else {
        req.unauthorize();
      }
    } else {
      const result = await getProfileSectionById(accountSid, { profileId, sectionId });

      if (isErr(result)) {
        return next(mapHTTPError(result, { InternalServerError: 500 }));
      }

      if (!result.data) {
        return next(createError(404));
      }

      const isAllowed = can(user, action, result.data);

      if (isAllowed) {
        req.authorize();
      } else {
        req.unauthorize();
      }
    }

    next();
  });
