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

import { getFromSSMCache } from '../config/ssmConfigurationCache';
import { rulesMap } from './rulesMap';
import { Permissions } from './index';
import { AccountSID } from '@tech-matters/types';

export const getPermissionsConfigName = async (accountSid: AccountSID) => {
  const { permissionConfig } = await getFromSSMCache(accountSid);

  if (!permissionConfig) throw new Error(`No permissions set for account ${accountSid}.`);

  if (!rulesMap[permissionConfig])
    throw new Error(
      `Permissions rules with name ${permissionConfig} missing in rules map.`,
    );

  return permissionConfig;
};

/**
 * @throws Will throw if there is no env var set for PERMISSIONS_${accountSid} or if it's an invalid key in rulesMap
 */
export const jsonPermissions: Permissions = {
  rules: async (accountSid: AccountSID) => {
    const permissionConfig = await getPermissionsConfigName(accountSid);

    const rules = rulesMap[permissionConfig];
    if (!rules) throw new Error(`Cannot find rules for ${permissionConfig}`);

    return rules;
  },
  cachePermissions: true,
};

export const openPermissions: Permissions = {
  rules: () => Promise.resolve(rulesMap.open),
  cachePermissions: true,
};

export const openRules = rulesMap.open;
