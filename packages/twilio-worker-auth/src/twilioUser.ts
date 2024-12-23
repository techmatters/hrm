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
import { AccountSID, TwilioUserIdentifier } from '@tech-matters/types';

export type TwilioUser = {
  accountSid: AccountSID;
  workerSid: TwilioUserIdentifier | undefined;
  roles: string[];
  isSupervisor: boolean;
  isSystemUser: boolean;
};

export const newTwilioUser = (
  accountSid: AccountSID,
  workerSid: TwilioUserIdentifier | undefined,
  roles: string[],
): Readonly<TwilioUser> =>
  Object.freeze({
    accountSid,
    workerSid,
    roles,
    isSupervisor: roles.includes('supervisor'),
    isSystemUser: false,
  });

export const newAccountSystemUser = (accountSid: AccountSID): Readonly<TwilioUser> =>
  Object.freeze({
    accountSid,
    workerSid: `account-${accountSid}`,
    roles: [],
    isSupervisor: false,
    isSystemUser: true,
  });

export const newGlobalSystemUser = (accountSid: AccountSID): Readonly<TwilioUser> =>
  Object.freeze({
    accountSid,
    workerSid: `system`,
    roles: [],
    isSupervisor: false,
    isSystemUser: true,
  });
