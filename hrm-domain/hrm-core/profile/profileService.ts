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

import {
  TResult,
  newErr,
  newOk,
  Result,
  isOk,
  ErrorResult,
  ensureRejection,
  isErr,
  newOkFromData,
} from '@tech-matters/types';
import { isFuture } from 'date-fns';

import * as profileDB from './profileDataAccess';
import { db } from '../connection-pool';
import { DatabaseErrorResult, inferPostgresErrorResult, txIfNotInOne } from '../sql';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import type { NewProfileSectionRecord } from './sql/profile-sections-sql';
import type { NewProfileFlagRecord } from './sql/profile-flags-sql';
import type { NewIdentifierRecord, NewProfileRecord } from './sql/profile-insert-sql';
import { ITask } from 'pg-promise';

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
  ): Promise<profileDB.ProfileWithRelationships | undefined> => {
    return profileDB.getProfileById(task)(accountSid, profileId);
  };

export const createIdentifierAndProfile =
  (task?) =>
  async (
    accountSid: string,
    payload: { identifier: NewIdentifierRecord; profile: NewProfileRecord },
    { user }: { user: TwilioUser },
  ): Promise<Result<DatabaseErrorResult, profileDB.IdentifierWithProfiles>> => {
    const { identifier, profile } = payload;

    return txIfNotInOne(task, async t => {
      try {
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

        return newOk({ data: idWithProfiles });
      } catch (err) {
        return inferPostgresErrorResult(err);
      }
    });
  };

export const getOrCreateProfileWithIdentifier =
  (task: ITask<any>) =>
  async (
    accountSid: string,
    payload: { identifier: NewIdentifierRecord; profile: NewProfileRecord },
    { user }: { user: TwilioUser },
  ): Promise<
    Result<
      DatabaseErrorResult,
      { identifier: profileDB.IdentifierWithProfiles; created: boolean }
    >
  > => {
    const { identifier, profile } = payload;

    if (!identifier?.identifier) {
      return null;
    }

    const profileResult = await profileDB.getIdentifierWithProfiles(task)({
      accountSid,
      identifier: identifier.identifier,
    });

    if (profileResult) {
      return newOk({ data: { identifier: profileResult, created: false } });
    }

    const createdResult = await createIdentifierAndProfile(task)(
      accountSid,
      { identifier, profile },
      { user },
    );
    if (isOk(createdResult)) {
      return newOk({ data: { identifier: createdResult.data, created: true } });
    } else {
      return createdResult;
    }
  };

export const createProfileWithIdentifierOrError = async (
  accountSid: string,
  payload: { identifier: NewIdentifierRecord; profile: NewProfileRecord },
  { user }: { user: TwilioUser },
): Promise<
  Result<
    DatabaseErrorResult | ErrorResult<'InvalidParameterError' | 'IdentifierExistsError'>,
    profileDB.IdentifierWithProfiles
  >
> => {
  const { identifier, profile } = payload;
  if (!identifier?.identifier) {
    return newErr({
      message: 'Missing identifier parameter',
      error: 'InvalidParameterError',
    });
  }
  const result = await ensureRejection<
    DatabaseErrorResult,
    { identifier: profileDB.IdentifierWithProfiles; created: boolean }
  >(db.task)(async conn =>
    getOrCreateProfileWithIdentifier(conn)(
      accountSid,
      {
        identifier,
        profile,
      },
      { user },
    ),
  );

  if (isOk(result)) {
    if (result.data.created === false) {
      return newErr({
        message: `Identifier ${identifier} already exists`,
        error: 'IdentifierExistsError',
      });
    }

    return newOk({ data: result.data.identifier });
  }
  return result;
};

export const getIdentifierByIdentifier = async (
  accountSid: string,
  identifier: string,
): Promise<profileDB.IdentifierWithProfiles> =>
  profileDB.getIdentifierWithProfiles()({
    accountSid,
    identifier,
  });

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
    'InvalidParameterError' | 'ProfileAlreadyFlaggedError',
    profileDB.ProfileWithRelationships
  >
> => {
  if (validUntil && !isFuture(validUntil)) {
    return newErr({
      error: 'InvalidParameterError',
      message: 'Invalid parameter "validUntil", must be a future date',
    });
  }
  return db.task(async t => {
    const result = await profileDB.associateProfileToProfileFlag(t)(
      accountSid,
      profileId,
      profileFlagId,
      validUntil,
    );

    if (isErr(result)) {
      if (result.error === 'ProfileNotFoundError') {
        return newOkFromData(undefined);
      } else if (result.error === 'ProfileFlagNotFoundError') {
        return newErr({
          error: 'InvalidParameterError',
          message: result.message,
        });
      } else if (result.error === 'ProfileAlreadyFlaggedError') {
        return result as ErrorResult<'ProfileAlreadyFlaggedError'>;
      }
      result.unwrap();
    }

    // trigger an update on profiles to keep track of who associated
    await profileDB.updateProfileById(t)(accountSid, {
      id: profileId,
      updatedBy: user.workerSid,
    });

    const profile = await profileDB.getProfileById(t)(accountSid, profileId);

    return newOk({ data: profile });
  });
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
): Promise<profileDB.ProfileWithRelationships> => {
  return db.task(async t => {
    const deleted = await profileDB.disassociateProfileFromProfileFlag(t)(
      accountSid,
      profileId,
      profileFlagId,
    );

    if (deleted) {
      // trigger an update on profiles to keep track of who disassociated
      await profileDB.updateProfileById(t)(accountSid, {
        id: profileId,
        updatedBy: user.workerSid,
      });
    }
    return profileDB.getProfileById(t)(accountSid, profileId);
  });
};

export const getProfileFlags = profileDB.getProfileFlagsForAccount;
export const getProfileFlagsByIdentifier = profileDB.getProfileFlagsByIdentifier;

export const createProfileFlag = async (
  accountSid: string,
  payload: NewProfileFlagRecord,
  { user }: { user: TwilioUser },
): Promise<TResult<'InvalidParameterError', profileDB.ProfileFlag>> => {
  const { name } = payload;

  const existingFlags = await getProfileFlags(accountSid);
  const existingFlag = existingFlags.find(flag => flag.name === name);

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

  return newOk({ data: pf });
};

export const updateProfileFlagById = async (
  accountSid: string,
  flagId: profileDB.ProfileFlag['id'],
  payload: {
    name: string;
  },
  { user }: { user: TwilioUser },
): Promise<TResult<'InvalidParameterError', profileDB.ProfileFlag>> => {
  const { name } = payload;

  const existingFlags = await getProfileFlags(accountSid);

  const existingFlag = existingFlags.find(flag => flag.name === name);

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

  return newOk({ data: profileFlag });
};

export const deleteProfileFlagById = async (
  flagId: profileDB.ProfileFlag['id'],
  accountSid: string,
): Promise<profileDB.ProfileFlag> => profileDB.deleteProfileFlagById(flagId, accountSid);

// While this is just a wrapper around profileDB.createProfileSection, we'll need more code to handle permissions soon
export const createProfileSection = async (
  accountSid: string,
  payload: NewProfileSectionRecord,
  { user }: { user: TwilioUser },
): Promise<profileDB.ProfileSection> => {
  const { content, profileId, sectionType } = payload;
  return profileDB.createProfileSection()(accountSid, {
    content,
    profileId,
    sectionType,
    createdBy: user.workerSid,
  });
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
): Promise<profileDB.ProfileSection> => {
  return profileDB.updateProfileSectionById()(accountSid, {
    ...payload,
    updatedBy: user.workerSid,
  });
};

// While this is just a wrapper around profileDB.getProfileSectionById, we'll need more code to handle permissions soon
export const getProfileSectionById = async (
  accountSid: string,
  payload: {
    profileId: profileDB.Profile['id'];
    sectionId: profileDB.ProfileSection['id'];
  },
): Promise<profileDB.ProfileSection> => {
  return profileDB.getProfileSectionById(accountSid, payload);
};
