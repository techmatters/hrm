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
  createIdentifierAndProfile,
  getIdentifierWithProfiles,
} from './profile-data-access';
// import { searchCasesByProfileId } from '../case/case';
// import { searchContactsByProfileId } from '../contact/contact';
// import { PaginationQuery } from '../search';
// import { setupCanForRules } from '../permissions/setupCanForRules';
// import { SearchPermissions } from '../permissions/search-permissions';
// import { TwilioUser } from '@tech-matters/twilio-worker-auth';
export { Identifier, Profile, getIdentifierWithProfiles };

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

export const getProfilesByIdentifier = async (
  accountSid: string,
  identifier: string,
  // query: Pick<PaginationQuery, 'limit' | 'offset'>,
  // ctx: {
  //   can: ReturnType<typeof setupCanForRules>;
  //   user: TwilioUser;
  //   searchPermissions: SearchPermissions;
  // },
): Promise<TResult<IdentifierWithProfiles>> => {
  try {
    const profilesResult = await getIdentifierWithProfiles()({ accountSid, identifier });

    if (isErr(profilesResult)) {
      return profilesResult;
    }

    // const result = await Promise.all(
    //   profiles.map(async p => {
    //     const [contacts, cases] = await Promise.all([
    //       searchContactsByProfileId(accountSid, { profileId: p.id }, query, ctx),
    //       searchCasesByProfileId(accountSid, query, { profileId: p.id }, {}, ctx),
    //     ]);

    //     return { profile: p, contacts, cases };
    //   }),
    // );

    return newOk({ data: profilesResult.data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
