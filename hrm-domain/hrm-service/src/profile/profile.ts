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
export { Identifier, Profile };

export const getOrCreateProfileWithIdentifier =
  (task?) =>
  async (
    idx: string,
    accountSid: string,
  ): Promise<Result<{ identifier: Identifier; profile: Profile }>> => {
    try {
      if (!idx) {
        return newSuccessResult({ data: { identifier: null, profile: null } });
      }

      const profileResult = await getIdentifierWithProfile(task)(accountSid, idx);

      if (isErrorResult(profileResult)) {
        return profileResult;
      }

      if (profileResult.data !== null) {
        return profileResult;
      }

      return await createIdentifierAndProfile(task)(accountSid, {
        identifier: idx,
      });
    } catch (err) {
      return newErrorResult({
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };