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

import { rulesMap } from './rulesMap';
import { Permissions } from './index';

export const getPermissionsConfigName = (accountSid: string) => {
  const permissionsKey = `PERMISSIONS_${accountSid}`;

  const permissionsConfigName = process.env[permissionsKey];

  if (!permissionsConfigName) throw new Error(`No permissions set for account ${accountSid}.`);

  if (!rulesMap[permissionsConfigName])
    throw new Error(`Permissions rules with name ${permissionsConfigName} missing in rules map.`);

  return permissionsConfigName;
};

/**
 * @throws Will throw if there is no env var set for PERMISSIONS_${accountSid} or if it's an invalid key in rulesMap
 */
export const jsonPermissions: Permissions = {
  rules: (accountSid: string) => {
    const permissionsConfigName = getPermissionsConfigName(accountSid);

    const rules = rulesMap[permissionsConfigName];
    if (!rules) throw new Error(`Cannot find rules for ${permissionsConfigName}`);
    return rules;
  },
  cachePermissions: true,
};

export const openPermissions: Permissions = {
  rules: () => rulesMap.open,
  cachePermissions: true,
};
