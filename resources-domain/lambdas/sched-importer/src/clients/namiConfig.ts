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

const getNamiPath =
  (name: string) =>
  ({ accountSid, environment = process.env.NODE_ENV }: Args) =>
    `/${environment}/resources/${accountSid}/import_api/nami/${name}`;

export const getNamiBaseUrlSsmPath = getNamiPath('base_url');
export const getNamiUsernameSsmPath = getNamiPath('username');
export const getNamiPasswordSsmPath = getNamiPath('password');
export const getNamiBaseUrl = createSsmParameterGetter(getNamiBaseUrlSsmPath);
export const getNamiUsername = createSsmParameterGetter(getNamiUsernameSsmPath);
export const getNamiPassword = createSsmParameterGetter(getNamiPasswordSsmPath);

export const getNamiApiConfig = async (args: Args) => {
  const [baseUrl, importApiUsername, importApiPassword] = await Promise.all([
    getNamiBaseUrl(args),
    getNamiUsername(args),
    getNamiPassword(args),
  ]);
  return {
    importApiBaseUrl: new URL(baseUrl),
    importApiKey: '',
    importApiAuthHeader: '',
    importApiUsername,
    importApiPassword,
  };
};
