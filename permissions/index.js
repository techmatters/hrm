const User = require('./user');
const { SafeRouter, publicEndpoint } = require('./safe-router');
const { applyPermissions: applyZaPermissions } = require('./rules/za');
const { applyPermissions: applyOpenPermissions } = require('./rules/open');
const { canEditCase } = require('./middlewares');

const applyPermissions = {
  zm: applyOpenPermissions,
  za: applyZaPermissions,
};

const setupPermissions = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    applyOpenPermissions(req);
    return next();
  }

  const { accountSid } = req;
  const permissionsKey = `PERMISSIONS_${accountSid}`;
  const permissions = process.env[permissionsKey];
  if (!permissions) throw new Error('permissions not provided for the specified accountSid.');

  applyPermissions[permissions](req);
  return next();
};

module.exports = { setupPermissions, User, SafeRouter, publicEndpoint, canEditCase };
