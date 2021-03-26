const CanCan = require('cancan');
const { isCounselorWhoCreated, isSupervisor, isCaseOpen } = require('./helpers');
const Actions = require('../actions');
const User = require('../user');
const models = require('../../models');

const cancan = new CanCan();
const { can, allow } = cancan;

const { Case } = models;

allow(
  User,
  Actions.CLOSE_CASE,
  Case,
  (user, caseObj) => true,
);

allow(User, Actions.REOPEN_CASE, Case, true);

allow(
  User,
  Actions.ADD_NOTE,
  Case,
  (user, caseObj) => true,
);

allow(User, Actions.EDIT_NOTE, Case, user => true);

allow(
  User,
  Actions.ADD_REFERRAL,
  Case,
  (user, caseObj) => true,
);

allow(
  User,
  Actions.EDIT_REFERRAL,
  Case,
  (user, caseObj) => true,
);

allow(
  User,
  Actions.ADD_HOUSEHOLD,
  Case,
  (user, caseObj) => true,
);

allow(
  User,
  Actions.EDIT_HOUSEHOLD,
  Case,
  (user, caseObj) => true,
);

allow(
  User,
  Actions.ADD_PERPETRATOR,
  Case,
  (user, caseObj) => true,
);

allow(
  User,
  Actions.EDIT_PERPETRATOR,
  Case,
  (user, caseObj) => true,
);

allow(
  User,
  Actions.ADD_INCIDENT,
  Case,
  (user, caseObj) => true,
);

allow(
  User,
  Actions.EDIT_INCIDENT,
  Case,
  (user, caseObj) => true,
);

allow(User, Actions.EDIT_CASE_SUMMARY, Case, user => true);

const applyPermissions = req => {
  req.can = can;
};

module.exports = { applyPermissions };
