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
  getProfileFlagsByIdentifierSql,
  insertProfileFlagSql,
  updateProfileFlagByIdSql,
  deleteProfileFlagByIdSql,
} from './sql/profile-flags-sql';
import { OrderByDirectionType, txIfNotInOne } from '../sql';
import * as profileGetSql from './sql/profile-get-sql';
import { db } from '../connection-pool';
import {
  NewProfileSectionRecord,
  getProfileSectionByIdSql,
  insertProfileSectionSql,
  updateProfileSectionByIdSql,
} from './sql/profile-sections-sql';
import {
  OrderByColumnType,
  ProfilesListFilters,
  listProfilesSql,
} from './sql/profile-list-sql';
import { getPaginationElements } from '../search';
import { updateProfileByIdSql } from './sql/profile-update.sql';

export { ProfilesListFilters } from './sql/profile-list-sql';

type RecordCommons = {
  id: number;
  accountSid: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
};

export type Identifier = NewIdentifierRecord & RecordCommons;

export type ProfileCounts = {
  contactsCount: number;
  casesCount: number;
};

export type ProfileWithCounts = Profile & ProfileCounts;

export type IdentifierWithProfiles = Identifier & { profiles: ProfileWithCounts[] };

type ProfileFlagAssociation = {
  id: ProfileFlag['id'];
  validUntil: Date | null;
};

export type ProfileWithRelationships = Profile &
  ProfileCounts & {
    identifiers: Identifier[];
    profileFlags: ProfileFlagAssociation[];
    profileSections: {
      sectionType: ProfileSection['sectionType'];
      id: ProfileSection['id'];
    }[];
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
  }: IdentifierParams): Promise<
    TResult<'InternalServerError', IdentifierWithProfiles | null>
  > => {
    const params = { accountSid, identifier, identifierId };
    try {
      const data = await txIfNotInOne<IdentifierWithProfiles>(task, async t => {
        /* We run two queries here, one to get the identifier and one to get the profiles
           because writing a single PERFORMANT query against tables that could eventually
           have millions of rows is hard. There is probably a better way to do this...
           but dev time is limited and this works for now.

           If you are thinking of changing this, please profile against a db with millions
           of rows in the tables and make sure it is performant.
        */
        const identifierData: Identifier = await t.oneOrNone(
          profileGetSql.getIdentifierSql,
          params,
        );

        if (!identifierData) {
          return null;
        }

        const profiles =
          (await t.manyOrNone(profileGetSql.getProfilesByIdentifierSql, params)) || [];

        return {
          ...identifierData,
          profiles,
        };
      });

      return newOk({ data });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
        error: 'InternalServerError',
      });
    }
  };

export const createIdentifier =
  (task?) =>
  async (
    accountSid: string,
    identifier: NewIdentifierRecord & Pick<RecordCommons, 'createdBy'>,
  ): Promise<Identifier> => {
    const now = new Date();

    const statement = insertIdentifierSql({
      ...identifier,
      createdAt: now,
      updatedAt: now,
      accountSid,
      updatedBy: null,
    });

    return txIfNotInOne<Identifier>(task, conn => conn.one(statement));
  };

export type Profile = NewProfileRecord & RecordCommons;

export const createProfile =
  (task?) =>
  async (
    accountSid: string,
    profile: NewProfileRecord & Pick<RecordCommons, 'createdBy'>,
  ): Promise<Profile> => {
    const now = new Date();

    const statement = insertProfileSql({
      ...profile,
      createdAt: now,
      updatedAt: now,
      accountSid,
      updatedBy: null,
    });

    return txIfNotInOne<Profile>(task, t => t.one(statement));
  };

export const updateProfileById =
  (task?) =>
  async (
    accountSid: string,
    payload: Partial<NewProfileRecord> & { id: number; updatedBy: Profile['updatedBy'] },
  ): Promise<TResult<'InternalServerError', Profile>> => {
    try {
      const { id, name, updatedBy } = payload;
      const now = new Date();
      const data = await txIfNotInOne<Profile>(task, async t => {
        return t.oneOrNone(
          updateProfileByIdSql({ name: name, updatedAt: now, updatedBy }),
          {
            profileId: id,
            accountSid,
          },
        );
      });
      return newOk({ data });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
        error: 'InternalServerError',
      });
    }
  };

export const associateProfileToIdentifier =
  (task?) =>
  async (
    accountSid: string,
    profileId: number,
    identifierId: number,
  ): Promise<TResult<'InternalServerError', IdentifierWithProfiles>> => {
    try {
      return await txIfNotInOne(task, async t => {
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
        error: 'InternalServerError',
      });
    }
  };

export const getProfileById =
  (task?) =>
  async (accountSid: string, profileId: number): Promise<ProfileWithRelationships> => {
    return txIfNotInOne<ProfileWithRelationships>(task, async t => {
      return t.oneOrNone(profileGetSql.getProfileByIdSql, { accountSid, profileId });
    });
  };

export type ProfileListConfiguration = {
  sortBy?: OrderByColumnType;
  sortDirection?: OrderByDirectionType;
  offset?: string;
  limit?: string;
};

export type SearchParameters = {
  filters?: ProfilesListFilters;
};

export const listProfiles = async (
  accountSid: string,
  listConfiguration: ProfileListConfiguration,
  { filters }: SearchParameters,
): Promise<
  TResult<'InternalServerError', { profiles: ProfileWithRelationships[]; count: number }>
> => {
  try {
    const { limit, offset, sortBy, sortDirection } =
      getPaginationElements(listConfiguration);
    const orderClause = [{ sortBy, sortDirection }];

    const { count, rows } = await db.task(async connection => {
      const result = await connection.any(listProfilesSql(filters || {}, orderClause), {
        accountSid,
        limit,
        offset,
        ...filters,
      });

      const totalCount: number = result.length ? result[0].totalCount : 0;
      return { rows: result, count: totalCount };
    });

    return newOk({ data: { profiles: rows, count } });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const associateProfileToProfileFlag =
  (task?) =>
  async (
    accountSid: string,
    profileId: number,
    profileFlagId: number,
    validUntil: Date | null,
  ): Promise<TResult<'InternalServerError', null>> => {
    try {
      const now = new Date();
      return await txIfNotInOne(task, async t => {
        await t.none(
          associateProfileToProfileFlagSql({
            accountSid,
            profileId,
            profileFlagId,
            createdAt: now,
            updatedAt: now,
            validUntil,
          }),
        );

        return newOk({ data: null });
      });
    } catch (err) {
      return newErr({
        message: err instanceof Error ? err.message : String(err),
        error: 'InternalServerError',
      });
    }
  };

export const disassociateProfileFromProfileFlag =
  (task?) =>
  async (
    accountSid: string,
    profileId: number,
    profileFlagId: number,
  ): Promise<TResult<'InternalServerError', null>> => {
    try {
      return await txIfNotInOne(task, async t => {
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
        error: 'InternalServerError',
      });
    }
  };

export type ProfileFlag = NewProfileFlagRecord & RecordCommons;

export const getProfileFlagsForAccount = async (
  accountSid: string,
): Promise<TResult<'InternalServerError', ProfileFlag[]>> => {
  try {
    return await db
      .task<ProfileFlag[]>(async t =>
        t.manyOrNone(getProfileFlagsByAccountSql, { accountSid }),
      )
      .then(data => newOk({ data }));
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const updateProfileFlagById = async (
  accountSid: string,
  payload: NewProfileFlagRecord & { id: number; updatedBy: ProfileFlag['updatedBy'] },
): Promise<TResult<'InternalServerError', ProfileFlag>> => {
  try {
    const { id, name, updatedBy } = payload;
    const now = new Date();
    const data = await db.task<ProfileFlag>(async t => {
      return t.oneOrNone(
        updateProfileFlagByIdSql({ name: name, updatedAt: now, updatedBy }),
        {
          profileId: id,
          accountSid,
        },
      );
    });
    return newOk({ data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const deleteProfileFlagById = async (
  profileId: number,
  accountSid: string,
): Promise<TResult<'InternalServerError', ProfileFlag>> => {
  try {
    const data = await db.task<ProfileFlag>(async t =>
      t.oneOrNone(deleteProfileFlagByIdSql, {
        profileId,
        accountSid,
      }),
    );

    return newOk({ data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const getProfileFlagsByIdentifier = async (
  accountSid: string,
  identifier: string,
): Promise<TResult<'InternalServerError', ProfileFlag[]>> => {
  try {
    return await db
      .task<ProfileFlag[]>(async t =>
        t.manyOrNone(getProfileFlagsByIdentifierSql, { accountSid, identifier }),
      )
      .then(data => newOk({ data }));
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const createProfileFlag = async (
  accountSid: string,
  payload: NewProfileFlagRecord & { createdBy: ProfileFlag['createdBy'] },
): Promise<TResult<'InternalServerError', ProfileFlag>> => {
  try {
    const now = new Date();
    const statement = insertProfileFlagSql({
      name: payload.name,
      createdAt: now,
      updatedAt: now,
      accountSid,
      createdBy: payload.createdBy,
      updatedBy: null,
    });

    return await db
      .task<ProfileFlag>(async t => t.one(statement))
      .then(data => newOk({ data }));
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export type ProfileSection = NewProfileSectionRecord &
  RecordCommons & {
    createdBy: string;
    updatedBy?: string;
  };

export const createProfileSection = async (
  accountSid: string,
  payload: NewProfileSectionRecord & { createdBy: ProfileSection['createdBy'] },
): Promise<TResult<'InternalServerError', ProfileSection>> => {
  try {
    const now = new Date();
    const statement = insertProfileSectionSql({
      ...payload,
      createdAt: now,
      updatedAt: now,
      accountSid,
      createdBy: payload.createdBy,
      updatedBy: null,
    });

    return await db
      .task<ProfileSection>(async t => t.oneOrNone(statement))
      .then(data => newOk({ data }));
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const updateProfileSectionById = async (
  accountSid: string,
  payload: {
    profileId: Profile['id'];
    sectionId: ProfileSection['id'];
    content: ProfileSection['content'];
    updatedBy: ProfileSection['updatedBy'];
  },
): Promise<TResult<'InternalServerError', ProfileSection>> => {
  try {
    const now = new Date();
    return await db
      .task<ProfileSection>(async t =>
        t.oneOrNone(updateProfileSectionByIdSql, {
          accountSid,
          profileId: payload.profileId,
          sectionId: payload.sectionId,
          content: payload.content,
          updatedBy: payload.updatedBy,
          updatedAt: now,
        }),
      )
      .then(data => newOk({ data }));
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const getProfileSectionById = async (
  accountSid: string,
  { profileId, sectionId }: { profileId: Profile['id']; sectionId: ProfileSection['id'] },
): Promise<TResult<'InternalServerError', ProfileSection>> => {
  try {
    const data = await db.task<ProfileSection>(async t =>
      t.oneOrNone(getProfileSectionByIdSql, { accountSid, profileId, sectionId }),
    );

    return newOk({ data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};
