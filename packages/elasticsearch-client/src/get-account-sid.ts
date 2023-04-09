import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';

const getAccountSid = (shortCode: string) => {
  return getSsmParameter(`/${process.env.NODE_ENV}/twilio/${shortCode.toUpperCase()}/account_sid`);
};

export default getAccountSid;
