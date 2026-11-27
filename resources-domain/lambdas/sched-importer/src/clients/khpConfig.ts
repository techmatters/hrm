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

import { createSsmParameterGetter } from '@tech-matters/aselo-config';

type Args = { accountSid: string; environment?: string };

export const getResourcesImportApiBaseUrlSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: Args) => `/${environment}/resources/${accountSid}/import_api/base_url`;

export const getResourcesImportApiKeySsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: Args) => `/${environment}/resources/${accountSid}/import_api/api_key`;

export const getResourcesImportApiAuthHeaderSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: Args) => `/${environment}/resources/${accountSid}/import_api/auth_header`;

export const getResourcesImportApiBaseUrl = createSsmParameterGetter(
  getResourcesImportApiBaseUrlSsmPath,
);
export const getResourcesImportApiKey = createSsmParameterGetter(
  getResourcesImportApiKeySsmPath,
);
export const getResourcesImportApiAuthHeader = createSsmParameterGetter(
  getResourcesImportApiAuthHeaderSsmPath,
);

export const getKhpApiConfig = async (args: Args) => {
  const [baseUrl, importApiKey, importApiAuthHeader] = await Promise.all([
    getResourcesImportApiBaseUrl(args),
    getResourcesImportApiKey(args),
    getResourcesImportApiAuthHeader(args),
  ]);
  return {
    importApiBaseUrl: new URL(baseUrl),
    importApiKey,
    importApiAuthHeader,
    importApiUsername: '',
    importApiPassword: '',
  };
};
