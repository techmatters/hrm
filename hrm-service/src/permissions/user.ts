import { setupCanForRules } from './setupCanForRules';

export class User {
  accountSid: string;

  workerSid: string;

  roles: string[];

  initializedCan: ReturnType<typeof setupCanForRules>;

  constructor(accountSid, workerSid: string, roles: string[]) {
    this.accountSid = accountSid;
    this.workerSid = workerSid;
    this.roles = roles;
  }

  can(action, target) {
    return this.initializedCan(this, action, target);
  }
}
