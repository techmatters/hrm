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
  Result,
  isErrorResult,
  newErrorResult,
  newSuccessResult,
} from '@tech-matters/types';
import {
  Identifier,
  Profile,
  createIdentifierAndProfile,
  getIdentifierWithProfile,
} from './profile-data-access';
import { searchCases } from '../case/case';
import { searchContactsByProfileId } from '../contact/contact';
import { PaginationQuery } from '../search';
import { setupCanForRules } from '../permissions/setupCanForRules';
import { SearchPermissions } from '../permissions/search-permissions';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
export { Identifier, Profile, getIdentifierWithProfile };

export const getOrCreateProfileWithIdentifier =
  (task?) =>
  async (
    idx: string,
    accountSid: string,
  ): Promise<Result<{ identifier: Identifier; profile: Profile }>> => {
    console.log('>>> start getOrCreateProfileWithIdentifier');
    try {
      if (!idx) {
        console.log('>>>idx is null');
        return newSuccessResult({ data: null });
      }

      const profileResult = await getIdentifierWithProfile(task)(accountSid, idx);

      if (isErrorResult(profileResult)) {
        console.log('>>>profileResult is error');
        return profileResult;
      }

      if (profileResult.data) {
        return profileResult;
      }

      return await createIdentifierAndProfile(task)(accountSid, {
        identifier: idx,
      });
    } catch (err) {
      console.log('>>>error in try/catch', err, err?.message);
      return newErrorResult({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

export const getProfilesByIdentifier = async (
  accountSid: string,
  idx: string,
  query: Pick<PaginationQuery, 'limit' | 'offset'>,
  ctx: {
    can: ReturnType<typeof setupCanForRules>;
    user: TwilioUser;
    searchPermissions: SearchPermissions;
  },
): Promise<
  Result<
    {
      profile: Profile;
      contacts: Awaited<ReturnType<typeof searchContactsByProfileId>>;
      cases: Awaited<ReturnType<typeof searchCases>>;
    }[]
  >
> => {
  try {
    const profilesResult = await getIdentifierWithProfile()(accountSid, idx);

    if (isErrorResult(profilesResult)) {
      console.log(`>>> Error while fetching profiles: ${profilesResult}`);
      return profilesResult;
    }

    const { profile } = profilesResult.data;
    console.log(`>>> 3 Found profile ${profile.id} for ${idx}`);

    const profiles = [profile];

    const result = await Promise.all(
      profiles.map(async p => {
        console.log(`>>> 4 Fetching contacts for profile ${p.id}`);
        const [contacts, cases] = await Promise.all([
          searchContactsByProfileId(accountSid, { profileId: p.id }, query, ctx),
          searchCases(accountSid, query, { contactNumber: idx }, ctx),
        ]);

        console.log(`>>> 4 Found ${contacts.count} contacts for profile ${p.id}`);
        console.log(`>>> 4 Found ${cases.count} cases for profile ${p.id}`);

        return { profile: p, contacts, cases };
      }),
    );

    console.log(`>>> 5 Returning ${result.length} results`);
    return newSuccessResult({ data: result });
  } catch (err) {
    return newErrorResult({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
