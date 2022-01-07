const User = require('./user');
const { SafeRouter, publicEndpoint } = require('./safe-router');
const { applyPermissions: applyZmPermissions } = require('./rules/zm');
const { applyPermissions: applyZaPermissions } = require('./rules/za');
const { applyPermissions: applyEtPermissions } = require('./rules/et');
const { applyPermissions: applyMwPermissions } = require('./rules/mw');
const { applyPermissions: applyBrPermissions } = require('./rules/br');
const { applyPermissions: applyInPermissions } = require('./rules/in');
const { applyPermissions: applyJmPermissions } = require('./rules/jm');
const { applyPermissions: applyOpenPermissions } = require('./rules/open');
const { canEditCase, canViewPostSurvey } = require('./middlewares');

const applyPermissions = {
  zm: applyZmPermissions,
  za: applyZaPermissions,
  et: applyEtPermissions,
  mw: applyMwPermissions,
  br: applyBrPermissions,
  in: applyInPermissions,
  jm: applyJmPermissions,
};

const setupPermissions = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    applyOpenPermissions(req);
    return next();
  }

  const { accountSid } = req;
  const permissionsKey = `PERMISSIONS_${accountSid}`;
  const permissions = process.env[permissionsKey];
  if (!applyPermissions[permissions])
    throw new Error('permissions not provided for the specified accountSid.');

  applyPermissions[permissions](req);
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
