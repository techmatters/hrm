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

import { isErr, mapHTTPError, newErr, newOk } from '@tech-matters/types';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import asyncHandler from '../async-handler';
import { getProfile as getProfileById, getProfileSectionById } from './profileService';
import type { Profile, ProfileSection } from './profileDataAccess';
import type { RequestWithPermissions } from '../permissions';
import type { InitializedCan } from '../permissions/initializeCanForRules';
import type { ActionsForTK } from '../permissions/actions';

export const canPerformActionOnProfile = async ({
  hrmAccountId,
  action,
  can,
  profileId,
  user,
}: {
  action: ActionsForTK<'profile'>;
  hrmAccountId: string;
  can: InitializedCan;
  profileId: Profile['id'];
  user: TwilioUser;
}) => {
  const result = await getProfileById()(hrmAccountId, profileId);

  const isAllowed = can(user, action, result);

  return newOk({ data: { isAllowed } });
};

export const canPerformActionOnProfileMiddleware = (
  action: ActionsForTK<'profile'>,
  parseRequest: (req: RequestWithPermissions) => {
    hrmAccountId: string;
    can: InitializedCan;
    profileId: Profile['id'];
    user: TwilioUser;
  },
) =>
  asyncHandler(async (req, _res, next) => {
    const { hrmAccountId, can, profileId, user } = parseRequest(req);

    const result = await canPerformActionOnProfile({
      action,
      hrmAccountId,
      can,
      profileId,
      user,
    });

    if (isErr(result)) {
      return next(
        mapHTTPError(result, { ProfileNotFoundError: 404, InternalServerError: 500 }),
      );
    }

    if (result.data.isAllowed) {
      console.debug(
        `[Permission - PERMITTED] User ${user.workerSid} is permitted to perform ${action} on ${hrmAccountId}/${profileId}`,
      );
      req.permit();
    } else {
      console.debug(
        `[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${action} on ${hrmAccountId}/${profileId} - rules failure`,
      );
      req.block();
    }

    next();
  });

export const canPerformActionOnProfileSection = async ({
  hrmAccountId,
  action,
  can,
  profileId,
  sectionId,
  user,
}: {
  action: ActionsForTK<'profileSection'>;
  hrmAccountId: string;
  can: InitializedCan;
  profileId: Profile['id'];
  sectionId: ProfileSection['id'] | null;
  user: TwilioUser;
}) => {
  if (sectionId === null && action === 'createProfileSection') {
    const isAllowed = can(user, action, null);
    return newOk({ data: { isAllowed } });
  }

  const result = await getProfileSectionById(hrmAccountId, { profileId, sectionId });

  if (!result) {
    return newErr({
      message: `Tried to retrieve profie section with profileId: ${profileId} and sectionId: ${sectionId}, not found`,
      error: 'ProfileSectionNotFoundError',
    });
  }

  const isAllowed = can(user, action, result);

  return newOk({ data: { isAllowed } });
};

export const canPerformActionOnProfileSectionMiddleware = (
  action: ActionsForTK<'profileSection'>,
  parseRequest: (req: RequestWithPermissions) => {
    hrmAccountId: string;
    can: InitializedCan;
    profileId: Profile['id'];
    sectionId: ProfileSection['id'] | null;
    user: TwilioUser;
  },
) =>
  asyncHandler(async (req, _res, next) => {
    const { hrmAccountId, can, profileId, sectionId, user } = parseRequest(req);

    const result = await canPerformActionOnProfileSection({
      hrmAccountId,
      action,
      can,
      profileId,
      sectionId,
      user,
    });

    if (isErr(result)) {
      return next(
        mapHTTPError(result, {
          ProfileSectionNotFoundError: 404,
        }),
      );
    }

    if (result.data.isAllowed) {
      req.permit();
    } else {
      req.block();
    }

    next();
  });
