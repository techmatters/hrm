// eslint-disable-next-line prettier/prettier
import type { AccountSID } from '@tech-matters/twilio-worker-auth';
import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';

const getConfig = async () => {
  const deploymentEnvironment = process.env.NODE_ENV;
  if (!deploymentEnvironment) {
    throw new Error('Missing NODE_ENV');
  }
  const helplineShortCode = process.env.helpline_short_code ?? 'as';
  
  const accountSid: AccountSID = (await getSsmParameter(
    `/${deploymentEnvironment}/twilio/${helplineShortCode.toUpperCase()}/account_sid`,
  )) as AccountSID;
  const [importApiBaseUrl, importApiKey, importApiAuthHeader, internalResourcesApiKey]  = await Promise.all([

    getSsmParameter(
      `/${deploymentEnvironment}/resources/${accountSid}/import_api/base_url`,
    ),
    getSsmParameter(
    `/${deploymentEnvironment}/resources/${accountSid}/import_api/api_key`,
    ),
    getSsmParameter(
      `/${deploymentEnvironment}/resources/${accountSid}/import_api/auth_header`,
    ),
    getSsmParameter(`/${deploymentEnvironment}/twilio/${accountSid}/static_key`),
  ]);
  return {
    importResourcesSqsQueueUrl: new URL(process.env.pending_sqs_queue_url ?? ''),
    internalResourcesBaseUrl: new URL(process.env.internal_resources_base_url ?? ''),
    internalResourcesApiKey,
    accountSid,
    importApiBaseUrl: new URL(importApiBaseUrl ?? ''),
    importApiKey,
    importApiAuthHeader,
  } as const;
};

export default getConfig;
