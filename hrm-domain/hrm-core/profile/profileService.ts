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
import { DatabaseErrorResult, inferPostgresErrorResult, txIfNotInOne } from '../sql';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import type { NewProfileSectionRecord } from './sql/profile-sections-sql';
import type { NewProfileFlagRecord } from './sql/profile-flags-sql';
import type { NewIdentifierRecord, NewProfileRecord } from './sql/profile-insert-sql';
import type { ITask } from 'pg-promise';
import type { HrmAccountId } from '@tech-matters/types';
import { getDbForAccount } from '../dbConnection';
import { notifyCreateProfile, notifyUpdateProfile } from './profileEntityBroadcast';

export {
  Identifier,
  Profile,
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
    accountSid: HrmAccountId,
    payload: {
      identifier: NewIdentifierRecord;
      profile: NewProfileRecord;
    },
    { user }: { user: TwilioUser },
  ): Promise<Result<DatabaseErrorResult, profileDB.IdentifierWithProfiles>> => {
    const { identifier, profile } = payload;
    const db = await getDbForAccount(accountSid);
    type QueryResult = {
      idWithProfiles: profileDB.IdentifierWithProfiles;
      updatedProfile: profileDB.Profile;
    };
    const queryResult = await txIfNotInOne<Result<DatabaseErrorResult, QueryResult>>(
      db,
      task,
      async t => {
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
          const updatedProfile = await profileDB.updateProfileById(t)(accountSid, {
            id: newProfile.id,
            updatedBy: user.workerSid,
          });

          return newOk({ data: { idWithProfiles, updatedProfile } });
        } catch (err) {
          return inferPostgresErrorResult(err);
        }
      },
    );
    if (isOk(queryResult)) {
      const { updatedProfile, idWithProfiles } = queryResult.data;
      await notifyCreateProfile({
        accountSid,
        profileOrId: {
          ...updatedProfile,
          identifiers: [idWithProfiles],
          profileFlags: [],
          profileSections: [],
          hasContacts: false,
        },
      });
      return newOkFromData(idWithProfiles);
    }
    return queryResult;
  };

export const getOrCreateProfileWithIdentifier =
  (task: ITask<any>) =>
  async (
    accountSid: HrmAccountId,
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
  accountSid: HrmAccountId,
  payload: { identifier: NewIdentifierRecord; profile: NewProfileRecord },
  { user }: { user: TwilioUser },
): Promise<
  Result<
    DatabaseErrorResult | ErrorResult<'InvalidParameterError' | 'IdentifierExistsError'>,
    profileDB.IdentifierWithProfiles
  >
> => {
  const db = await getDbForAccount(accountSid);
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
  accountSid: HrmAccountId,
  identifier: string,
): Promise<profileDB.IdentifierWithProfiles> =>
  profileDB.getIdentifierWithProfiles()({
    accountSid,
    identifier: identifier,
  });

export const listProfiles = profileDB.listProfiles;

export const associateProfileToProfileFlag = async (
  accountSid: HrmAccountId,
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
  const db = await getDbForAccount(accountSid);
  const finalResult = await db.task<
    TResult<
      'InvalidParameterError' | 'ProfileAlreadyFlaggedError',
      profileDB.ProfileWithRelationships
    >
  >(async t => {
    const result = await profileDB.associateProfileToProfileFlag(t)(
      accountSid,
      profileId,
      profileFlagId,
      validUntil,
      { user },
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
      result.unwrap(); // Q for SJH: This bubbles the error. Is this intentional?
      return;
    }
    return newOkFromData(result);
  });
  if (isOk(finalResult)) {
    await notifyUpdateProfile({ accountSid, profileOrId: finalResult.data });
  }
  return finalResult;
};

export const disassociateProfileFromProfileFlag = async (
  accountSid: HrmAccountId,
  {
    profileId,
    profileFlagId,
  }: {
    profileId: profileDB.Profile['id'];
    profileFlagId: number;
  },
  { user }: { user: TwilioUser },
): Promise<profileDB.ProfileWithRelationships> => {
  const db = await getDbForAccount(accountSid);
  const profile = await db.task(async t =>
    profileDB.disassociateProfileFromProfileFlag(t)(
      accountSid,
      profileId,
      profileFlagId,
      { user },
    ),
  );
  await notifyUpdateProfile({ accountSid, profileOrId: profile });
  return profile;
};

export const getProfileFlags = profileDB.getProfileFlagsForAccount;
export const getProfileFlagsByIdentifier = profileDB.getProfileFlagsByIdentifier;

export const createProfileFlag = async (
  accountSid: HrmAccountId,
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

// TODO: If we start using this, we either need to add code to automatically broadcast entity updates for all affected profiles, or the code using it has to handle the broadcasts itself
export const updateProfileFlagById = async (
  accountSid: HrmAccountId,
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
// TODO: If we start using this, we either need to add code to automatically broadcast entity updates for all associated profiles, or the code using it has to handle the broadcasts itself
export const deleteProfileFlagById = async (
  flagId: profileDB.ProfileFlag['id'],
  accountSid: HrmAccountId,
): Promise<profileDB.ProfileFlag> => profileDB.deleteProfileFlagById(flagId, accountSid);

export const createProfileSection = async (
  accountSid: HrmAccountId,
  payload: NewProfileSectionRecord,
  { user }: { user: TwilioUser },
): Promise<profileDB.ProfileSection> => {
  const { content, profileId, sectionType } = payload;
  const section = await profileDB.createProfileSection()(accountSid, {
    content,
    profileId,
    sectionType,
    createdBy: user.workerSid,
  });
  await notifyUpdateProfile({ accountSid, profileOrId: payload.profileId });
  return section;
};

export const updateProfileSectionById = async (
  accountSid: HrmAccountId,
  payload: {
    profileId: profileDB.Profile['id'];
    sectionId: profileDB.ProfileSection['id'];
    content: profileDB.ProfileSection['content'];
  },
  { user }: { user: TwilioUser },
): Promise<profileDB.ProfileSection> => {
  const section = await profileDB.updateProfileSectionById()(accountSid, {
    ...payload,
    updatedBy: user.workerSid,
  });
  if (section) {
    await notifyUpdateProfile({ accountSid, profileOrId: payload.profileId });
  }
  return section;
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
