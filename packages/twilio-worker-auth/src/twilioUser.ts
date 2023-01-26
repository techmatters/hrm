export type TwilioUser = {
  workerSid: string;

  roles: string[];
  isSupervisor: boolean;
};

export const twilioUser = (workerSid: string, roles: string[]): Readonly<TwilioUser> =>
  Object.freeze({
    workerSid,
    roles,
    isSupervisor: roles.includes('supervisor'),
  });
