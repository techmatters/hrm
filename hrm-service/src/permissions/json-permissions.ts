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
