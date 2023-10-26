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

import {
  Identifier,
  IdentifierWithProfiles,
  Profile,
  ProfileWithRelationships,
  associateProfileToProfileFlag as associateProfileToProfileFlagDAL,
  disassociateProfileFromProfileFlag as disassociateProfileFromProfileFlagDAL,
  createIdentifierAndProfile,
  getIdentifierWithProfiles,
  getProfileById,
  getProfileFlagsForAccount,
} from './profile-data-access';
import { db } from '../connection-pool';

export { Identifier, Profile, getIdentifierWithProfiles };

export const getProfile =
  (task?) =>
  async (
    accountSid: string,
    profileId: Profile['id'],
  ): Promise<TResult<ProfileWithRelationships>> => {
    try {
      const result = await getProfileById(task)(accountSid, profileId);

      if (!result) {
        return newErr({ statusCode: 404, message: 'Profile not found' });
      }

      return newOk({ data: result });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

export const getOrCreateProfileWithIdentifier =
  (task?) =>
  async (
    identifier: string,
    accountSid: string,
  ): Promise<TResult<IdentifierWithProfiles>> => {
    try {
      if (!identifier) {
        return newOk({ data: null });
      }

      const profileResult = await getIdentifierWithProfiles(task)({
        accountSid,
        identifier,
      });

      if (isErr(profileResult) || profileResult.data) {
        return profileResult;
      }

      return await createIdentifierAndProfile(task)(accountSid, {
        identifier,
      });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

export const getIdentifierByIdentifier = async (
  accountSid: string,
  identifier: string,
): Promise<TResult<IdentifierWithProfiles>> => {
  try {
    const profilesResult = await getIdentifierWithProfiles()({ accountSid, identifier });

    if (isErr(profilesResult)) {
      return profilesResult;
    }

    return newOk({ data: profilesResult.data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export const associateProfileToProfileFlag = async (
  accountSid: string,
  profileId: Profile['id'],
  profileFlagId: number,
): Promise<TResult<ProfileWithRelationships>> => {
  try {
    return await db.task<TResult<ProfileWithRelationships>>(async t => {
      await associateProfileToProfileFlagDAL(t)(accountSid, profileId, profileFlagId);
      const profile = await getProfileById(t)(accountSid, profileId);

      return newOk({ data: profile });
    });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export const disassociateProfileFromProfileFlag = async (
  accountSid: string,
  profileId: Profile['id'],
  profileFlagId: number,
): Promise<TResult<ProfileWithRelationships>> => {
  try {
    return await db.task<TResult<ProfileWithRelationships>>(async t => {
      await disassociateProfileFromProfileFlagDAL(t)(
        accountSid,
        profileId,
        profileFlagId,
      );
      const profile = await getProfileById(t)(accountSid, profileId);

      return newOk({ data: profile });
    });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export const getProfileFlags = getProfileFlagsForAccount;
