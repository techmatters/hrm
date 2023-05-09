/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

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
