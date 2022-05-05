import { setupCanForRules } from './setupCanForRules';

const openRules = require('../../permission-rules/open.json');
const brRules = require('../../permission-rules/br.json');
const caRules = require('../../permission-rules/ca.json');
const etRules = require('../../permission-rules/et.json');
const inRules = require('../../permission-rules/in.json');
const jmRules = require('../../permission-rules/jm.json');
const mwRules = require('../../permission-rules/mw.json');
const ukRules = require('../../permission-rules/uk.json');
const zaRules = require('../../permission-rules/za.json');
const zmRules = require('../../permission-rules/zm.json');

// TODO: maybe factor out so it's easier to build the API that retrieves this to the frontend
const rulesMap = {
  br: brRules,
  ca: caRules,
  et: etRules,
  in: inRules,
  jm: jmRules,
  mw: mwRules,
  uk: ukRules,
  za: zaRules,
  zm: zmRules,
  open: openRules,
};

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

const initializedCanOpenRules = setupCanForRules(openRules);

/**
 * Applies the permissions if valid.
 * @param {import('express').Request} req
 * @param {ReturnType<typeof setupCanForRules>} initializedCan
 * @param {string} permissionsConfig
 * @throws Will throw if initializedCan is not a function
 */
export const applyPermissions = (req, initializedCan, permissionsConfig) => {
  if (!initializedCan) throw new Error(`Cannot find rules for ${permissionsConfig}`);

  if (typeof initializedCan === 'string')
    throw new Error(`Error in rules for ${permissionsConfig}. Error: ${initializedCan}`);

  if (typeof initializedCan !== 'function')
    throw new Error(`Error in rules for ${permissionsConfig}. Error: can is not a function.`);

  req.can = initializedCan;
};

export const setupPermissions = (req, res, next) => {
  if (process.env.USE_OPEN_PERMISSIONS) {
    applyPermissions(req, initializedCanOpenRules, 'open rules');
    return next();
  }

  const { accountSid } = req;
  const permissionsKey = `PERMISSIONS_${accountSid}`;
  const permissionsConfig = process.env[permissionsKey];
  const initializedCan = initializedCanMap[permissionsConfig];

  applyPermissions(req, initializedCan, permissionsConfig);
  return next();
};

export * from './middlewares';
export * from './safe-router';
export * from './user';
