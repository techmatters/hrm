// eslint-disable-next-line max-classes-per-file
const User = class {
  constructor(workerSid, roles) {
    this.workerSid = workerSid;
    this.roles = roles;
  }
};

class Resource {
  constructor(workerSid) {
    this.workerSid = workerSid;
  }
}

const ContactResource = class extends Resource {};
const CaseResource = class extends Resource {};

module.exports = { User, ContactResource, CaseResource };
