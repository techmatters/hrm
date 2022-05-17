export class User {
  workerSid: string;

  roles: string[];

  constructor(workerSid: string, roles: string[]) {
    this.workerSid = workerSid;
    this.roles = roles;
  }
}
