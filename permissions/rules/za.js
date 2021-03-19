const CanCan = require('cancan');
const { isCounselorWhoCreated, isSupervisor } = require('./helpers');
const Actions = require('../actions');
const User = require('../user');
const models = require('../../models');

const cancan = new CanCan();
const { can, allow } = cancan;

const { Case } = models;

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.CLOSE_CASE) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) => options.actions.includes(Actions.REOPEN_CASE) && isSupervisor(user),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_NOTE) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) => options.actions.includes(Actions.EDIT_NOTE) && isSupervisor(user),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_REFERRAL) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_REFERRAL) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_HOUSEHOLD) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_HOUSEHOLD) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_PERPETRATOR) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_PERPETRATOR) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_INCIDENT) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_INCIDENT) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_CASE_SUMMARY) &&
    (isCounselorWhoCreated(user, caseObj) || isSupervisor(user)),
);

const applyPermissions = req => {
  req.can = can;
};

module.exports = { applyPermissions };
