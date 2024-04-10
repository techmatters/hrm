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

import * as profileDB from './profileDataAccess';
import { db } from '../connection-pool';
import { txIfNotInOne } from '../sql';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import type { NewProfileSectionRecord } from './sql/profile-sections-sql';
import type { NewProfileFlagRecord } from './sql/profile-flags-sql';
import type { NewIdentifierRecord, NewProfileRecord } from './sql/profile-insert-sql';

export {
  Identifier,
  Profile,
  getIdentifierWithProfiles,
  ProfileListConfiguration,
  SearchParameters,
} from './profileDataAccess';

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

export const createIdentifierAndProfile =
  (task?) =>
  async (
    accountSid: string,
    payload: { identifier: NewIdentifierRecord; profile: NewProfileRecord },
    { user }: { user: TwilioUser },
  ): Promise<TResult<'InternalServerError', profileDB.IdentifierWithProfiles>> => {
    try {
      const { identifier, profile } = payload;

      return await txIfNotInOne(task, async t => {
        const newIdentifier = await profileDB.createIdentifier(t)(accountSid, {
          identifier: identifier.identifier,
          createdBy: user.workerSid,
        });
        const newProfile = await profileDB.createProfile(t)(accountSid, {
          name: profile.name || null,
          createdBy: user.workerSid,
        });

        const idWithProfiles = await profileDB.associateProfileToIdentifier(t)(
          accountSid,
          newProfile.id,
          newIdentifier.id,
        );

        // trigger an update on profiles to keep track of who associated
        await profileDB.updateProfileById(t)(accountSid, {
          id: newProfile.id,
          updatedBy: user.workerSid,
        });

        return idWithProfiles;
      });
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
    accountSid: string,
    payload: { identifier: NewIdentifierRecord; profile: NewProfileRecord },
    { user }: { user: TwilioUser },
  ): Promise<
    TResult<
      'InternalServerError',
      { identifier: profileDB.IdentifierWithProfiles; created: boolean }
    >
  > => {
    try {
      const { identifier, profile } = payload;

      if (!identifier?.identifier) {
        return newOk({ data: null });
      }

      const profileResult = await profileDB.getIdentifierWithProfiles(task)({
        accountSid,
        identifier: identifier.identifier,
      });

      if (isErr(profileResult)) {
        return profileResult;
      }

      if (profileResult.data) {
        return newOk({ data: { identifier: profileResult.data, created: false } });
      }

      const createdResult = await createIdentifierAndProfile(task)(
        accountSid,
        { identifier, profile },
        { user },
      );

      if (isErr(createdResult)) {
        return createdResult;
      }

      return newOk({ data: { identifier: createdResult.data, created: true } });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
        error: 'InternalServerError',
      });
    }
  };

export const createProfileWithIdentifierOrError =
  (task?) =>
  async (
    accountSid: string,
    payload: { identifier: NewIdentifierRecord; profile: NewProfileRecord },
    { user }: { user: TwilioUser },
  ): Promise<
    TResult<
      'InternalServerError' | 'InvalidParameterError' | 'IdentifierExistsError',
      profileDB.IdentifierWithProfiles
    >
  > => {
    try {
      const { identifier, profile } = payload;
      if (!identifier?.identifier) {
        return newErr({
          message: 'Missing identifier parameter',
          error: 'InvalidParameterError',
        });
      }

      const result = await getOrCreateProfileWithIdentifier(task)(
        accountSid,
        {
          identifier,
          profile,
        },
        { user },
      );

      if (isErr(result)) {
        return result;
      }

      if (result.data.created === false) {
        return newErr({
          message: `Identifier ${identifier} already exists`,
          error: 'IdentifierExistsError',
        });
      }

      return newOk({ data: result.data.identifier });
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
  {
    profileId,
    profileFlagId,
    validUntil,
  }: {
    profileId: profileDB.Profile['id'];
    profileFlagId: number;
    validUntil: Date | null;
  },
  { user }: { user: TwilioUser },
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
      await profileDB
        .associateProfileToProfileFlag(t)(
          accountSid,
          profileId,
          profileFlagId,
          validUntil,
        )
        .then(r => r.unwrap()); // unwrap the result to bubble error up (if any)

      // trigger an update on profiles to keep track of who associated
      await profileDB.updateProfileById(t)(accountSid, {
        id: profileId,
        updatedBy: user.workerSid,
      });

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
  {
    profileId,
    profileFlagId,
  }: {
    profileId: profileDB.Profile['id'];
    profileFlagId: number;
  },
  { user }: { user: TwilioUser },
): Promise<TResult<'InternalServerError', profileDB.ProfileWithRelationships>> => {
  try {
    return await db.task(async t => {
      await profileDB
        .disassociateProfileFromProfileFlag(t)(accountSid, profileId, profileFlagId)
        .then(r => r.unwrap()); // unwrap the result to bubble error up (if any);

      // trigger an update on profiles to keep track of who disassociated
      await profileDB.updateProfileById(t)(accountSid, {
        id: profileId,
        updatedBy: user.workerSid,
      });
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

export const createProfileFlag = async (
  accountSid: string,
  payload: NewProfileFlagRecord,
  { user }: { user: TwilioUser },
): Promise<
  TResult<'InternalServerError' | 'InvalidParameterError', profileDB.ProfileFlag>
> => {
  try {
    const { name } = payload;

    const existingFlags = await getProfileFlags(accountSid);

    if (isErr(existingFlags)) {
      // Handle the error case here. For example, you can return the error.
      return existingFlags;
    }

    const existingFlag = existingFlags.data.find(flag => flag.name === name);

    if (existingFlag) {
      return newErr({
        message: `Flag with name "${name}" already exists`,
        error: 'InvalidParameterError',
      });
    }

    const pf = await profileDB.createProfileFlag(accountSid, {
      name,
      createdBy: user.workerSid,
    });

    return pf;
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const updateProfileFlagById = async (
  accountSid: string,
  flagId: profileDB.ProfileFlag['id'],
  payload: {
    name: string;
  },
  { user }: { user: TwilioUser },
): Promise<
  TResult<'InternalServerError' | 'InvalidParameterError', profileDB.ProfileFlag>
> => {
  try {
    const { name } = payload;

    const existingFlags = await getProfileFlags(accountSid);

    if (isErr(existingFlags)) {
      // Handle the error case here. For example, you can return the error.
      return existingFlags;
    }

    const existingFlag = existingFlags.data.find(flag => flag.name === name);

    if (existingFlag) {
      return newErr({
        message: `Flag with name "${name}" already exists`,
        error: 'InvalidParameterError',
      });
    }
    const profileFlag = await profileDB.updateProfileFlagById(accountSid, {
      id: flagId,
      name,
      updatedBy: user.workerSid,
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
): Promise<TResult<'InternalServerError', profileDB.ProfileFlag>> => {
  try {
    const result = await profileDB.deleteProfileFlagById(flagId, accountSid);
    return result;
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
