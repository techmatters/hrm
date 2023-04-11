import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';

const getAccountSid = (configId: string) => {
  return getSsmParameter(`/${process.env.NODE_ENV}/twilio/${configId.toUpperCase()}/account_sid`);
};

export default getAccountSid;
