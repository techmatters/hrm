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
import { TResult, newOk, newErr } from '@tech-matters/types';

import {
  NewIdentifierRecord,
  NewProfileRecord,
  insertIdentifierSql,
  insertProfileSql,
  associateProfileToIdentifierSql,
} from './sql/profile-insert-sql';
import {
  NewProfileFlagRecord,
  associateProfileToProfileFlagSql,
  disassociateProfileFromProfileFlagSql,
  getProfileFlagsByAccountSql,
  insertProfileFlagSql,
} from './sql/profile-flags-sql';
import { txIfNotInOne } from '../sql';
import { getProfileByIdSql, joinProfilesIdentifiersSql } from './sql/profile-get-sql';
import { db } from '../connection-pool';

type RecordCommons = {
  id: number;
  accountSid: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Identifier = NewIdentifierRecord & RecordCommons;

export type ProfileCounts = {
  contactsCount: number;
  casesCount: number;
};

export type ProfileWithCounts = Profile & ProfileCounts;

export type IdentifierWithProfiles = Identifier & { profiles: ProfileWithCounts[] };

export type ProfileWithRelationships = Profile &
  ProfileCounts & {
    identifiers: Identifier[];
  };

type IdentifierParams =
  | { accountSid: string; identifier: string; identifierId?: never }
  | { accountSid: string; identifierId: number; identifier?: never };

export const getIdentifierWithProfiles =
  (task?) =>
  async ({
    accountSid,
    identifier,
    identifierId,
  }: IdentifierParams): Promise<TResult<IdentifierWithProfiles | null>> => {
    try {
      const result = await txIfNotInOne<{ data: IdentifierWithProfiles }>(task, async t =>
        t.oneOrNone(joinProfilesIdentifiersSql, {
          accountSid,
          identifier,
          identifierId,
        }),
      );

      return newOk({ data: result ? result.data : null });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

const createIdentifier =
  (task?) =>
  async (accountSid: string, identifier: NewIdentifierRecord): Promise<Identifier> => {
    const now = new Date();

    const statement = insertIdentifierSql({
      ...identifier,
      createdAt: now,
      updatedAt: now,
      accountSid,
    });

    return txIfNotInOne<Identifier>(task, conn => conn.one(statement));
  };

export type Profile = NewProfileRecord & RecordCommons;

const createProfile =
  (task?) =>
  async (accountSid: string, profile: NewProfileRecord): Promise<Profile> => {
    const now = new Date();

    const statement = insertProfileSql({
      ...profile,
      createdAt: now,
      updatedAt: now,
      accountSid,
    });

    return txIfNotInOne<Profile>(task, t => t.one(statement));
  };

export const associateProfileToIdentifier =
  (task?) =>
  async (
    accountSid: string,
    profileId: number,
    identifierId: number,
  ): Promise<TResult<IdentifierWithProfiles>> => {
    try {
      return await txIfNotInOne<TResult<IdentifierWithProfiles>>(task, async t => {
        const now = new Date();
        await t.none(
          associateProfileToIdentifierSql({
            accountSid,
            profileId,
            identifierId,
            createdAt: now,
            updatedAt: now,
          }),
        );

        return getIdentifierWithProfiles(t)({
          accountSid,
          identifierId,
        });
      });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

export const createIdentifierAndProfile =
  (task?) =>
  async (
    accountSid: string,
    payload: NewIdentifierRecord,
  ): Promise<TResult<IdentifierWithProfiles>> => {
    try {
      return await txIfNotInOne<TResult<IdentifierWithProfiles>>(task, async t => {
        const [newIdentifier, newProfile] = await Promise.all([
          createIdentifier(t)(accountSid, payload),
          createProfile(t)(accountSid, { name: null }),
        ]);

        return associateProfileToIdentifier(t)(
          accountSid,
          newProfile.id,
          newIdentifier.id,
        );
      });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

export const getProfileById =
  (task?) =>
  async (accountSid: string, profileId: number): Promise<ProfileWithRelationships> => {
    return txIfNotInOne<ProfileWithRelationships>(task, async t => {
      return t.oneOrNone(getProfileByIdSql, { accountSid, profileId });
    });
  };

export const associateProfileToProfileFlag =
  (task?) =>
  async (
    accountSid: string,
    profileId: number,
    profileFlagId: number,
  ): Promise<TResult<null>> => {
    try {
      return await txIfNotInOne<TResult<null>>(task, async t => {
        await t.none(
          associateProfileToProfileFlagSql({
            accountSid,
            profileId,
            profileFlagId,
          }),
        );

        return newOk({ data: null });
      });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

export const disassociateProfileFromProfileFlag =
  (task?) =>
  async (
    accountSid: string,
    profileId: number,
    profileFlagId: number,
  ): Promise<TResult<null>> => {
    try {
      return await txIfNotInOne<TResult<null>>(task, async t => {
        await t.none(disassociateProfileFromProfileFlagSql, {
          accountSid,
          profileId,
          profileFlagId,
        });

        return newOk({ data: null });
      });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

export type ProfileFlag = NewProfileFlagRecord & RecordCommons;

export const getProfileFlagsForAccount = async (
  accountSid: string,
): Promise<TResult<ProfileFlag[]>> => {
  try {
    return await db
      .task<ProfileFlag[]>(async t =>
        t.manyOrNone(getProfileFlagsByAccountSql, { accountSid }),
      )
      .then(data => newOk({ data }));
  } catch (err) {
    console.error(err);
    return newErr({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export const createProfileFlag = async (
  accountSid: string,
  payload: NewProfileFlagRecord,
): Promise<TResult<ProfileFlag>> => {
  try {
    const now = new Date();
    const statement = insertProfileFlagSql({
      name: payload.name,
      createdAt: now,
      updatedAt: now,
      accountSid,
    });

    return await db
      .task<ProfileFlag>(async t => t.one(statement))
      .then(data => newOk({ data }));
  } catch (err) {
    console.error(err);
    return newErr({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
