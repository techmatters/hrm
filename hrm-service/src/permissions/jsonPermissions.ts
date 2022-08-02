import { rulesMap } from './rulesMap';
import { setupCanForRules } from './setupCanForRules';
import { Permissions } from './index';

const initializedCanMap = Object.entries(rulesMap).reduce<
  { [key in keyof typeof rulesMap]: ReturnType<typeof setupCanForRules> }
>((accum, [key, rules]) => {
  const can = setupCanForRules(rules);
  return {
    ...accum,
    [key]: can,
  };
}, null);

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
const lookup: Permissions = {
  checker: (accountSid: string) => {
    if (process.env.USE_OPEN_PERMISSIONS) {
      return initializedCanMap.open;
    }

    const permissionsConfigName = getPermissionsConfigName(accountSid);
    const initializedCan = initializedCanMap[permissionsConfigName];

    if (!initializedCan) throw new Error(`Cannot find rules for ${permissionsConfigName}`);

    if (typeof initializedCan === 'string')
      throw new Error(`Error in rules for ${permissionsConfigName}. Error: ${initializedCan}`);

    return initializedCan;
  },
  rules: (accountSid: string) => {
    const permissionsConfigName = getPermissionsConfigName(accountSid);

    return rulesMap[permissionsConfigName];
  },
};

export default lookup;
