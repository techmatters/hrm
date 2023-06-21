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
import type { AccountSID } from '@tech-matters/types';
import { getSsmParameter } from '@tech-matters/ssm-cache';

const debugGetSsmParameter = async (path: string, logValue = false) => {
  console.debug(`Getting SSM parameter: ${path}`);
  try {
    const value = await getSsmParameter(path);
    console.debug(`Got SSM parameter: ${path} value: ${logValue ? value : value.replace(/./g, '*')}`);
    return value;
  } catch (e) {
    console.error(`Error getting SSM parameter: ${path}`, e);
    throw e;
  }
};

const getConfig = async () => {
  const deploymentEnvironment = process.env.NODE_ENV;
  if (!deploymentEnvironment) {
    throw new Error('Missing NODE_ENV');
  }
  const helplineShortCode = process.env.helpline_short_code ?? 'as';
  console.debug(`helplineShortCode: ${helplineShortCode}`);

  const accountSid: AccountSID = (await debugGetSsmParameter(
    `/${deploymentEnvironment}/twilio/${helplineShortCode.toUpperCase()}/account_sid`,
  )) as AccountSID;

  const [importApiBaseUrl, importApiKey, importApiAuthHeader, internalResourcesApiKey]  = await Promise.all([

    debugGetSsmParameter(
      `/${deploymentEnvironment}/resources/${accountSid}/import_api/base_url`, true,
    ),
    debugGetSsmParameter(
    `/${deploymentEnvironment}/resources/${accountSid}/import_api/api_key`,
    ),
    debugGetSsmParameter(
      `/${deploymentEnvironment}/resources/${accountSid}/import_api/auth_header`,
    ),
    debugGetSsmParameter(`/${deploymentEnvironment}/twilio/${accountSid}/static_key`),
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
