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
import {
  DatabaseErrorResult,
  inferPostgresErrorResult,
  isDatabaseForeignKeyViolationErrorResult,
  isDatabaseUniqueConstraintViolationErrorResult,
  OrderByDirectionType,
  txIfNotInOne,
} from '../sql';
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
import { TOUCH_PROFILE_SQL, updateProfileByIdSql } from './sql/profile-update.sql';
import {
  ensureRejection,
  ErrorResult,
  newErr,
  newOkFromData,
  Result,
  TwilioUserIdentifier,
  HrmAccountId,
} from '@tech-matters/types';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';

export { ProfilesListFilters } from './sql/profile-list-sql';

type RecordCommons = {
  id: number;
  accountSid: HrmAccountId;
  createdAt: Date;
  updatedAt: Date;
  createdBy: TwilioUserIdentifier;
  updatedBy?: TwilioUserIdentifier;
};

export type Identifier = NewIdentifierRecord & RecordCommons;

export type IdentifierWithProfiles = Identifier & { profiles: Profile[] };

type ProfileFlagAssociation = {
  id: ProfileFlag['id'];
  validUntil: Date | null;
};

export type ProfileWithRelationships = Profile & {
  identifiers: Identifier[];
  profileFlags: ProfileFlagAssociation[];
  profileSections: {
    sectionType: ProfileSection['sectionType'];
    id: ProfileSection['id'];
  }[];
  hasContacts: boolean;
};

type IdentifierParams =
  | { accountSid: HrmAccountId; identifier: string; identifierId?: never }
  | { accountSid: HrmAccountId; identifierId: number; identifier?: never };

export const getIdentifierWithProfiles =
  (task?) =>
  async ({
    accountSid,
    identifier,
    identifierId,
  }: IdentifierParams): Promise<IdentifierWithProfiles> => {
    const params = { accountSid, identifier, identifierId };
    return txIfNotInOne<IdentifierWithProfiles>(task, async t => {
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
  };

export const createIdentifier =
  (task?) =>
  async (
    accountSid: HrmAccountId,
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
    accountSid: HrmAccountId,
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
    accountSid: HrmAccountId,
    payload: Partial<NewProfileRecord> & { id: number; updatedBy: Profile['updatedBy'] },
  ): Promise<Profile> => {
    const { id, name, updatedBy } = payload;
    const now = new Date();
    return txIfNotInOne<Profile>(task, async t => {
      return t.oneOrNone(
        updateProfileByIdSql({ name: name, updatedAt: now, updatedBy }),
        {
          profileId: id,
          accountSid,
        },
      );
    });
  };

export const associateProfileToIdentifier =
  task =>
  async (
    accountSid: HrmAccountId,
    profileId: number,
    identifierId: number,
  ): Promise<IdentifierWithProfiles> => {
    return txIfNotInOne(task, async t => {
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
  accountSid: HrmAccountId,
  listConfiguration: ProfileListConfiguration,
  { filters }: SearchParameters,
): Promise<{ profiles: ProfileWithRelationships[]; count: number }> => {
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

  return { profiles: rows, count };
};

export const associateProfileToProfileFlag =
  (task?) =>
  async (
    accountSid: HrmAccountId,
    profileId: number,
    profileFlagId: number,
    validUntil: Date | null,
    { user }: { user: TwilioUser },
  ): Promise<
    Result<
      | DatabaseErrorResult
      | ErrorResult<
          | 'ProfileNotFoundError'
          | 'ProfileFlagNotFoundError'
          | 'ProfileAlreadyFlaggedError'
        >,
      ProfileWithRelationships
    >
  > => {
    const now = new Date();
    return ensureRejection<
      | DatabaseErrorResult
      | ErrorResult<
          | 'ProfileNotFoundError'
          | 'ProfileFlagNotFoundError'
          | 'ProfileAlreadyFlaggedError'
        >,
      ProfileWithRelationships
    >(work => txIfNotInOne(task, work))(async t => {
      try {
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

        await t.none(TOUCH_PROFILE_SQL, {
          updatedBy: user.workerSid,
          accountSid,
          profileId,
        });

        const profile = await getProfileById(t)(accountSid, profileId);
        return newOkFromData(profile);
      } catch (e) {
        console.error(e);
        const errorResult = inferPostgresErrorResult(e);
        if (isDatabaseForeignKeyViolationErrorResult(errorResult)) {
          if (
            errorResult.constraint ===
            'ProfilesToProfileFlags_profileFlagId_ProfileFlags_id_fk'
          ) {
            return newErr({
              error: 'ProfileFlagNotFoundError',
              message: `[${accountSid}] Profile flag with id ${profileFlagId} not found - trying to set for profile ${profileId}.`,
            });
          }
          if (
            errorResult.constraint === 'ProfilesToProfileFlags_profileId_Profiles_id_fk'
          ) {
            return newErr({
              error: 'ProfileNotFoundError',
              message: `[${accountSid}] Profile with id ${profileId} not found - when trying to set flag ${profileFlagId} on it.`,
            });
          }
        }
        if (isDatabaseUniqueConstraintViolationErrorResult(errorResult)) {
          return newErr({
            error: 'ProfileAlreadyFlaggedError',
            message: `[${accountSid}] Profile with id ${profileId} already has flag ${profileFlagId} set on it.`,
          });
        }
        return errorResult;
      }
    });
  };

export const disassociateProfileFromProfileFlag =
  (task?) =>
  async (
    accountSid: HrmAccountId,
    profileId: number,
    profileFlagId: number,
    { user }: { user: TwilioUser },
  ): Promise<ProfileWithRelationships> =>
    txIfNotInOne(task, async t => {
      const { count } = await t.oneOrNone<{ count: string }>(
        disassociateProfileFromProfileFlagSql,
        {
          accountSid,
          profileId,
          profileFlagId,
        },
      );

      if (Boolean(parseInt(count, 10))) {
        await t.none(TOUCH_PROFILE_SQL, {
          updatedBy: user.workerSid,
          accountSid,
          profileId,
        });
      }

      const profile = await getProfileById(t)(accountSid, profileId);
      return profile;
    });

export type ProfileFlag = NewProfileFlagRecord & RecordCommons;

export const getProfileFlagsForAccount = async (
  accountSid: HrmAccountId,
): Promise<ProfileFlag[]> => {
  return db.task<ProfileFlag[]>(async t =>
    t.manyOrNone(getProfileFlagsByAccountSql, { accountSid }),
  );
};

export const updateProfileFlagById = async (
  accountSid: HrmAccountId,
  payload: NewProfileFlagRecord & { id: number; updatedBy: ProfileFlag['updatedBy'] },
): Promise<ProfileFlag> => {
  const { id, name, updatedBy } = payload;
  const now = new Date();
  return db.task<ProfileFlag>(async t => {
    return t.oneOrNone(updateProfileFlagByIdSql({ name, updatedAt: now, updatedBy }), {
      profileId: id,
      accountSid,
    });
  });
};

export const deleteProfileFlagById = async (
  profileFlagId: number,
  accountSid: HrmAccountId,
): Promise<ProfileFlag> => {
  return db.task<ProfileFlag>(async t =>
    t.oneOrNone(deleteProfileFlagByIdSql, {
      accountSid,
      profileFlagId,
    }),
  );
};

export const getProfileFlagsByIdentifier = async (
  accountSid: HrmAccountId,
  identifier: string,
): Promise<ProfileFlag[]> => {
  return db.task<ProfileFlag[]>(async t =>
    t.manyOrNone(getProfileFlagsByIdentifierSql, { accountSid, identifier }),
  );
};

export const createProfileFlag = async (
  accountSid: HrmAccountId,
  payload: NewProfileFlagRecord & { createdBy: ProfileFlag['createdBy'] },
): Promise<ProfileFlag> => {
  const now = new Date();
  const statement = insertProfileFlagSql({
    name: payload.name,
    createdAt: now,
    createdBy: payload.createdBy,
    updatedAt: now,
    updatedBy: payload.createdBy,
    accountSid,
  });

  return db.task<ProfileFlag>(async t => t.one(statement));
};

export type ProfileSection = NewProfileSectionRecord &
  RecordCommons & {
    createdBy: string;
    updatedBy?: string;
  };

export const createProfileSection =
  (task?) =>
  async (
    accountSid: string,
    payload: NewProfileSectionRecord & { createdBy: ProfileSection['createdBy'] },
  ): Promise<ProfileSection> => {
    const now = new Date();
    const statement = insertProfileSectionSql({
      ...payload,
      createdAt: now,
      updatedAt: now,
      accountSid,
      createdBy: payload.createdBy,
      updatedBy: null,
    });

    return txIfNotInOne(task, async t => {
      const section = await t.oneOrNone<ProfileSection>(statement);

      if (section) {
        // trigger an update on profiles
        await t.none(TOUCH_PROFILE_SQL, {
          updatedBy: payload.createdBy,
          profileId: payload.profileId,
          accountSid,
        });
      }

      return section;
    });
  };

export const updateProfileSectionById =
  (task?) =>
  async (
    accountSid: string,
    payload: {
      profileId: Profile['id'];
      sectionId: ProfileSection['id'];
      content: ProfileSection['content'];
      updatedBy: ProfileSection['updatedBy'];
    },
  ): Promise<ProfileSection> => {
    const now = new Date();
    return txIfNotInOne(task, async t => {
      const section = await t.oneOrNone<ProfileSection>(updateProfileSectionByIdSql, {
        accountSid,
        profileId: payload.profileId,
        sectionId: payload.sectionId,
        content: payload.content,
        updatedBy: payload.updatedBy,
        updatedAt: now,
      });

      if (section) {
        // trigger an update on profiles
        await t.none(TOUCH_PROFILE_SQL, {
          updatedBy: payload.updatedBy,
          profileId: payload.profileId,
          accountSid,
        });
      }

      return section;
    });
  };

export const getProfileSectionById = async (
  accountSid: string,
  { profileId, sectionId }: { profileId: Profile['id']; sectionId: ProfileSection['id'] },
): Promise<ProfileSection> =>
  db.task<ProfileSection>(async t =>
    t.oneOrNone(getProfileSectionByIdSql, { accountSid, profileId, sectionId }),
  );
