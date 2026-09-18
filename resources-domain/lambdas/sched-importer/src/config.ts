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

import type { AccountSID } from '@tech-matters/types';
import {
  getAccountStaticKey,
  getResourcesImportApiAuthHeader,
  getResourcesImportApiAuthHeaderSsmPath,
  getResourcesImportApiBaseUrl,
  getResourcesImportApiBaseUrlSsmPath,
  getResourcesImportApiKey,
  getResourcesImportApiKeySsmPath,
  getS3DocsBucketName,
  getS3DocsBucketNameSsmPath,
  getTwilioAccountSid,
  getTwilioAccountSidSsmPath,
} from '@tech-matters/aselo-config';

const debugGetSsmParameter = async (
  path: string,
  getter: () => Promise<string>,
  logValue = false,
) => {
  console.debug(`Getting SSM parameter: ${path}`);
  try {
    const value = await getter();
    console.debug(
      `Got SSM parameter: ${path} value: ${logValue ? value : value.replace(/./g, '*')}`,
    );
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
    getTwilioAccountSidSsmPath(helplineShortCode, deploymentEnvironment),
    () => getTwilioAccountSid(helplineShortCode, deploymentEnvironment),
  )) as AccountSID;

  const [
    importApiBaseUrl,
    importApiKey,
    importApiAuthHeader,
    internalResourcesApiKey,
    docsBucket,
  ] = await Promise.all([
    debugGetSsmParameter(
      getResourcesImportApiBaseUrlSsmPath(accountSid, deploymentEnvironment),
      () => getResourcesImportApiBaseUrl(accountSid, deploymentEnvironment),
      true,
    ),
    debugGetSsmParameter(
      getResourcesImportApiKeySsmPath(accountSid, deploymentEnvironment),
      () => getResourcesImportApiKey(accountSid, deploymentEnvironment),
    ),
    debugGetSsmParameter(
      getResourcesImportApiAuthHeaderSsmPath(accountSid, deploymentEnvironment),
      () => getResourcesImportApiAuthHeader(accountSid, deploymentEnvironment),
    ),
    getAccountStaticKey(accountSid),
    debugGetSsmParameter(
      getS3DocsBucketNameSsmPath(accountSid, deploymentEnvironment),
      () => getS3DocsBucketName(accountSid, deploymentEnvironment),
    ),
  ]);
  return {
    importResourcesSqsQueueUrl: new URL(process.env.pending_sqs_queue_url ?? ''),
    internalResourcesBaseUrl: new URL(process.env.internal_resources_base_url ?? ''),
    internalResourcesApiKey,
    accountSid,
    importApiBaseUrl: new URL(importApiBaseUrl ?? ''),
    importApiKey,
    importApiAuthHeader,
    maxBatchSize: Number(process.env.RESOURCE_IMPORT_MAX_BATCH_SIZE ?? 20000),
    maxApiSize: Number(process.env.RESOURCE_IMPORT_MAX_API_SIZE ?? 200),
    maxRequests: Number(process.env.RESOURCE_IMPORT_MAX_REQUESTS ?? 200),
    largeMessagesS3Bucket: docsBucket,
  } as const;
};

export default getConfig;
