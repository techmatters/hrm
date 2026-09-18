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

// export * from './ssmParameterNameGetters';

import { getSsmParameter, SsmParameterNotFound } from '@tech-matters/ssm-cache';
import {
  getHrmStaticKeySsmPath,
  getTwilioStaticKeySsmPath,
} from './ssmParameterNameGetters';

export const getHrmStaticKey = (...params: Parameters<typeof getHrmStaticKeySsmPath>) =>
  getSsmParameter(getHrmStaticKeySsmPath(...params));
export const getTwilioStaticKey = (
  ...params: Parameters<typeof getTwilioStaticKeySsmPath>
) => getSsmParameter(getTwilioStaticKeySsmPath(...params));

export const getAccountStaticKey = async (keyName: string) => {
  try {
    return await getHrmStaticKey(keyName);
  } catch (error) {
    // Remove when a terraform apply has been done for all accounts
    if (error instanceof SsmParameterNotFound && keyName.startsWith('AC')) {
      console.warn(
        `New internal API key not set up for ${keyName} yet, looking for legacy key`,
      );

      return getTwilioStaticKey(keyName);
    }

    throw error;
  }
};
