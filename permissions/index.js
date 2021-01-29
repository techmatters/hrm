const CanCan = require('cancan');
const { User, ContactResource, CaseResource } = require('./resources');

const cancan = new CanCan();
const { allow, can } = cancan;

const setupPermissions = () => {
  allow(User, 'view', CaseResource);
  // Here we could check if user.role === 'admin' as well
  allow(
    User,
    'edit',
    CaseResource,
    (user, caseResource) => user.workerSid === caseResource.workerSid,
  );
};

module.exports = { can, setupPermissions, User, ContactResource, CaseResource };
