export type User = {
  workerSid: string;

  roles: string[];
};

export const user = (workerSid: string, roles: string[]): User => ({
  workerSid,
  roles,
});
