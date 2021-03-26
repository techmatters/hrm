const CanCan = require('cancan');
const User = require('../user');
const models = require('../../models');

const cancan = new CanCan();
const { can, allow } = cancan;

const { Case } = models;

allow(User, 'manage', Case);

const applyPermissions = req => {
  req.can = can;
};

module.exports = { applyPermissions };
