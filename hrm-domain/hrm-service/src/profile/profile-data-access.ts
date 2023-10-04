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
import { Result, newSuccessResult, newErrorResult } from '@tech-matters/types';

import {
  NewIdentifierRecord,
  NewProfileRecord,
  insertIdentifierSql,
  insertProfileSql,
  associateProfileToIdentifierSql,
} from './sql/profile-insert-sql';
import { txIfNotInOne } from '../sql';
import { joinProfilesIdentifiersSql } from './sql/profile-get-sql';

type RecordCommons = {
  id: number;
  accountSid: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Identifier = NewIdentifierRecord & RecordCommons;

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

    return txIfNotInOne<Profile>(task, conn => conn.one(statement));
  };

export const createIdentifierAndProfile =
  (task?) =>
  async (
    accountSid: string,
    payload: NewIdentifierRecord,
  ): Promise<{ identifier: Identifier; profile: Profile }> => {
    return txIfNotInOne<{
      identifier: Identifier;
      profile: Profile;
    }>(task, async t => {
      const [newIdentifier, newProfile] = await Promise.all([
        createIdentifier(t)(accountSid, payload),
        createProfile(t)(accountSid, { name: null }),
      ]);

      // Link the profile and identifier
      const now = new Date();
      await t.none(
        associateProfileToIdentifierSql({
          accountSid,
          profileId: newIdentifier.id,
          identifierId: newProfile.id,
          createdAt: now,
          updatedAt: now,
        }),
      );

      return { identifier: newIdentifier, profile: newProfile };
    });
  };

export const getIdentifierWithProfile =
  (task?) =>
  async (
    accountSid: string,
    identifier: string,
  ): Promise<Result<{ identifierId: number; profileId: number } | null>> => {
    try {
      const record = await txIfNotInOne<{ identifierId: number; profileId: number }>(
        task,
        async connection => {
          return connection.oneOrNone(joinProfilesIdentifiersSql, {
            accountSid,
            identifier,
          });
        },
      );

      return newSuccessResult({ data: record });
    } catch (err) {
      return newErrorResult({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
