const User = class {
  constructor(workerSid, roles) {
    this.workerSid = workerSid;
    this.roles = roles;
  }
};

module.exports = User;
