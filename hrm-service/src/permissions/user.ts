import { setupCanForRules } from './setupCanForRules';

export class User {
  workerSid: string;

  roles: string[];

  initializedCan: ReturnType<typeof setupCanForRules>;

  constructor(workerSid: string, roles: string[]) {
    this.workerSid = workerSid;
    this.roles = roles;
  }

  can(action, target) {
    return this.initializedCan(this, action, target);
  }
}
