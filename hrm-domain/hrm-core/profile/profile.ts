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

import { TResult, isErr, newErr, newOk } from '@tech-matters/types';
import { isFuture } from 'date-fns';

import * as profileDB from './profile-data-access';
import { db } from '../connection-pool';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import type { NewProfileSectionRecord } from './sql/profile-sections-sql';

export { Identifier, Profile, getIdentifierWithProfiles } from './profile-data-access';
export { ProfileListConfiguration, SearchParameters } from './profile-data-access';

export const getProfile =
  (task?) =>
  async (
    accountSid: string,
    profileId: profileDB.Profile['id'],
  ): Promise<
    TResult<
      'ProfileNotFoundError' | 'InternalServerError',
      profileDB.ProfileWithRelationships
    >
  > => {
    try {
      const result = await profileDB.getProfileById(task)(accountSid, profileId);

      if (!result) {
        return newErr({
          message: 'Profile not found',
          error: 'ProfileNotFoundError',
        });
      }

      return newOk({ data: result });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
        error: 'InternalServerError',
      });
    }
  };

export const getOrCreateProfileWithIdentifier =
  (task?) =>
  async (
    identifier: string,
    accountSid: string,
  ): Promise<TResult<'InternalServerError', profileDB.IdentifierWithProfiles>> => {
    try {
      if (!identifier) {
        return newOk({ data: null });
      }

      const profileResult = await profileDB.getIdentifierWithProfiles(task)({
        accountSid,
        identifier,
      });

      if (isErr(profileResult) || profileResult.data) {
        return profileResult;
      }

      return await profileDB.createIdentifierAndProfile(task)(accountSid, {
        identifier,
      });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
        error: 'InternalServerError',
      });
    }
  };

export const getIdentifierByIdentifier = async (
  accountSid: string,
  identifier: string,
): Promise<TResult<'InternalServerError', profileDB.IdentifierWithProfiles>> => {
  try {
    const profilesResult = await profileDB.getIdentifierWithProfiles()({
      accountSid,
      identifier,
    });

    if (isErr(profilesResult)) {
      return profilesResult;
    }

    return newOk({ data: profilesResult.data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const listProfiles = profileDB.listProfiles;

export const associateProfileToProfileFlag = async (
  accountSid: string,
  profileId: profileDB.Profile['id'],
  profileFlagId: number,
  validUntil: Date | null,
): Promise<
  TResult<
    'InvalidParameterError' | 'InternalServerError',
    profileDB.ProfileWithRelationships
  >
> => {
  try {
    if (validUntil && !isFuture(validUntil)) {
      return newErr({
        error: 'InvalidParameterError',
        message: 'Invalid parameter "validUntil", must be a future date',
      });
    }

    return await db.task(async t => {
      (
        await profileDB.associateProfileToProfileFlag(t)(
          accountSid,
          profileId,
          profileFlagId,
          validUntil,
        )
      ).unwrap(); // unwrap the result to bubble error up (if any)
      const profile = await profileDB.getProfileById(t)(accountSid, profileId);

      return newOk({ data: profile });
    });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const disassociateProfileFromProfileFlag = async (
  accountSid: string,
  profileId: profileDB.Profile['id'],
  profileFlagId: number,
): Promise<TResult<'InternalServerError', profileDB.ProfileWithRelationships>> => {
  try {
    return await db.task(async t => {
      (
        await profileDB.disassociateProfileFromProfileFlag(t)(
          accountSid,
          profileId,
          profileFlagId,
        )
      ).unwrap(); // unwrap the result to bubble error up (if any);
      const profile = await profileDB.getProfileById(t)(accountSid, profileId);

      return newOk({ data: profile });
    });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const getProfileFlags = profileDB.getProfileFlagsForAccount;
export const getProfileFlagsByIdentifier = profileDB.getProfileFlagsByIdentifier;

export const updateProfileFlagById = async (
  accountSid: string,
  flagId: profileDB.ProfileFlag['id'],
  payload: {
    name: string;
  },
): Promise<TResult<'InternalServerError', profileDB.ProfileFlag>> => {
  try {
    const { name } = payload;
    const profileFlag = await profileDB.updateProfileFlagById(accountSid, {
      id: flagId,
      name,
    });

    return profileFlag;
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const deleteProfileFlagById = async (
  flagId: profileDB.ProfileFlag['id'],
  accountSid: string,
): Promise<TResult<'InternalServerError', void>> => {
  try {
    await profileDB.deleteProfileFlagById(flagId, accountSid);
    return newOk({ data: undefined });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

// While this is just a wrapper around profileDB.createProfileSection, we'll need more code to handle permissions soon
export const createProfileSection = async (
  accountSid: string,
  payload: NewProfileSectionRecord,
  { user }: { user: TwilioUser },
): Promise<TResult<'InternalServerError', profileDB.ProfileSection>> => {
  try {
    const { content, profileId, sectionType } = payload;
    const ps = await profileDB.createProfileSection(accountSid, {
      content,
      profileId,
      sectionType,
      createdBy: user.workerSid,
    });

    return ps;
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

// While this is just a wrapper around profileDB.updateProfileSectionById, we'll need more code to handle permissions soon
export const updateProfileSectionById = async (
  accountSid: string,
  payload: {
    profileId: profileDB.Profile['id'];
    sectionId: profileDB.ProfileSection['id'];
    content: profileDB.ProfileSection['content'];
  },
  { user }: { user: TwilioUser },
): Promise<TResult<'InternalServerError', profileDB.ProfileSection>> => {
  try {
    const ps = await profileDB.updateProfileSectionById(accountSid, {
      ...payload,
      updatedBy: user.workerSid,
    });

    return ps;
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

// While this is just a wrapper around profileDB.getProfileSectionById, we'll need more code to handle permissions soon
export const getProfileSectionById = async (
  accountSid: string,
  payload: {
    profileId: profileDB.Profile['id'];
    sectionId: profileDB.ProfileSection['id'];
  },
): Promise<TResult<'InternalServerError', profileDB.ProfileSection>> => {
  try {
    const ps = await profileDB.getProfileSectionById(accountSid, payload);

    return ps;
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};
