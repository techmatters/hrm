const CanCan = require('cancan');
const models = require('../models');
const { SafeRouter, publicEndpoint } = require('./safe-router');

const { Case } = models;

const cancan = new CanCan();
const { allow, can } = cancan;

const User = class {
  constructor(workerSid, roles) {
    this.workerSid = workerSid;
    this.roles = roles;
  }
};

const setupPermissions = () => {
  allow(User, 'view', Case);
  // Here we could check if user.role === 'admin' as well
  allow(
    User,
    'edit',
    Case,
    (user, caseObj) => user.workerSid === caseObj.dataValues.twilioWorkerId,
  );
};

module.exports = { can, setupPermissions, User, SafeRouter, publicEndpoint };
