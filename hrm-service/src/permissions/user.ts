export const User = class {
  workerSid: string;

  roles: string[];

  constructor(workerSid, roles) {
    this.workerSid = workerSid;
    this.roles = roles;
  }
};
