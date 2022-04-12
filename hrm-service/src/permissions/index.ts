const User = require('./user');
const { SafeRouter, publicEndpoint } = require('./safe-router');
const { setupCanForRules } = require('./setupCanForRules');

const { canEditCase, canViewPostSurvey } = require('./middlewares');
const { rulesMap } = require('./rulesMap');

/**
 * @type {{ [key in keyof typeof rulesMap]: ReturnType<typeof setupCanForRules> }}
 */
const initializedCanMap = Object.entries(rulesMap).reduce((accum, [key, rules]) => {
  const can = setupCanForRules(rules);
  return {
    ...accum,
    [key]: can,
  };
}, {});

/**
 * Applies the permissions if valid.
 * @param {import('express').Request} req
 * @param {ReturnType<typeof setupCanForRules>} initializedCan
 * @param {string} permissionsConfig
 * @throws Will throw if initializedCan is not a function
 */
const applyPermissions = (req, initializedCan, permissionsConfig) => {
  if (!initializedCan) throw new Error(`Cannot find rules for ${permissionsConfig}`);

  if (typeof initializedCan === 'string')
    throw new Error(`Error in rules for ${permissionsConfig}. Error: ${initializedCan}`);

  if (typeof initializedCan !== 'function')
    throw new Error(`Error in rules for ${permissionsConfig}. Error: can is not a function.`);

  req.can = initializedCan;
};

const setupPermissions = (req, res, next) => {
  if (process.env.USE_OPEN_PERMISSIONS) {
    applyPermissions(req, initializedCanMap.open, 'open rules');
    return next();
  }

  const { accountSid } = req;
  const permissionsKey = `PERMISSIONS_${accountSid}`;
  const permissionsConfig = process.env[permissionsKey];
  const initializedCan = initializedCanMap[permissionsConfig];

  applyPermissions(req, initializedCan, permissionsConfig);
  return next();
};

module.exports = {
  setupPermissions,
  User,
  SafeRouter,
  publicEndpoint,
  canEditCase,
  canViewPostSurvey,
};
