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
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.CLOSE_CASE) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
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
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
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
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_REFERRAL) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_HOUSEHOLD) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_HOUSEHOLD) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_PERPETRATOR) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_PERPETRATOR) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.ADD_INCIDENT) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_INCIDENT) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

allow(
  User,
  'edit',
  Case,
  (user, caseObj, options) =>
    options.actions.includes(Actions.EDIT_CASE_SUMMARY) &&
    (isSupervisor(user) || (isCaseOpen(caseObj) && isCounselorWhoCreated(user, caseObj))),
);

const applyPermissions = req => {
  req.can = can;
};

module.exports = { applyPermissions };
