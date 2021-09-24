const CanCan = require('cancan');
const User = require('../user');
const models = require('../../models');
const Actions = require('../actions');

const cancan = new CanCan();
const { can, allow } = cancan;

const { Case, PostSurvey } = models;

allow(User, 'manage', Case);

allow(User, Actions.VIEW_POST_SURVEY, PostSurvey);

const applyPermissions = req => {
  req.can = can;
};

module.exports = { applyPermissions };
