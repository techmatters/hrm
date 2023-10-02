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
  insertProfileToIdentifierSql,
} from './sql/client-profile-insert-sql';
import { txIfNotInOne } from '../sql';
import { joinProfilesIdentifiersSql } from './sql/client-profile-get-sql';

type RecordCommons = {
  id: number;
  accountSid: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ClientIdentifier = NewIdentifierRecord & RecordCommons;

const createClientIdentifier =
  (task?) =>
  async (
    accountSid: string,
    identifier: NewIdentifierRecord,
  ): Promise<ClientIdentifier> => {
    const now = new Date();

    const statement = insertIdentifierSql({
      ...identifier,
      createdAt: now,
      updatedAt: now,
      accountSid,
    });

    return txIfNotInOne<ClientIdentifier>(task, conn => conn.one(statement));
  };

export type ClientProfile = NewProfileRecord & RecordCommons;

const createClientProfile =
  (task?) =>
  async (accountSid: string, profile: NewProfileRecord): Promise<ClientProfile> => {
    const now = new Date();

    const statement = insertProfileSql({
      ...profile,
      createdAt: now,
      updatedAt: now,
      accountSid,
    });

    return txIfNotInOne<ClientProfile>(task, conn => conn.one(statement));
  };

export const createIdentifierAndProfile =
  (task?) =>
  async (
    accountSid: string,
    payload: NewIdentifierRecord,
  ): Promise<{ identifier: ClientIdentifier; profile: ClientProfile }> => {
    return txIfNotInOne<{
      identifier: ClientIdentifier;
      profile: ClientProfile;
    }>(task, async t => {
      const [newIdentifier, newProfile] = await Promise.all([
        createClientIdentifier(t)(accountSid, payload),
        createClientProfile(t)(accountSid, { name: null }),
      ]);

      // Link the profile and identifier
      const now = new Date();
      await t.none(
        insertProfileToIdentifierSql({
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
  ): Promise<Result<{ identifierId: number; profileId: number }>> => {
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
