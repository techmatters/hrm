export type TwilioUser = {
  workerSid: string;

  roles: string[];
};

export const twilioUser = (workerSid: string, roles: string[]): TwilioUser => ({
  workerSid,
  roles,
});

export const isSupervisor = (possibleSupervisor: TwilioUser) =>
  possibleSupervisor.roles.includes('supervisor');
